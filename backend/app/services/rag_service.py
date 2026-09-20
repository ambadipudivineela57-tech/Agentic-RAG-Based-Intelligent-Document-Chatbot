import json
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.app.db.models import Conversation, Message
from backend.app.schemas.chat import ChatResponse, ChatMetadata, SourceCitation
from backend.app.graph.workflow import run_agentic_rag
from backend.app.core.logging import logger

class RAGService:
    def process_chat(
        self,
        db: Session,
        user_id: str,
        question: str,
        document_ids: Optional[List[str]] = None,
        conversation_id: Optional[str] = None,
    ) -> ChatResponse:
        history_list = []
        conversation = None

        # 1. Load conversation context if conversation_id provided
        if conversation_id:
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
            ).first()

            if conversation:
                # Get last 8 messages for context
                past_messages = (
                    db.query(Message)
                    .filter(Message.conversation_id == conversation_id)
                    .order_by(Message.created_at.desc())
                    .limit(8)
                    .all()
                )
                for pm in reversed(past_messages):
                    history_list.append({
                        "role": pm.role,
                        "content": pm.content
                    })

                # Record user message
                user_msg = Message(
                    conversation_id=conversation_id,
                    role="user",
                    content=question
                )
                db.add(user_msg)
                db.commit()

        # 2. Run LangGraph Agentic RAG
        final_state = run_agentic_rag(
            question=question,
            user_id=user_id,
            document_ids=document_ids,
            conversation_history=history_list,
        )

        answer = final_state.get("answer", "")
        raw_sources = final_state.get("sources", [])
        retry_count = final_state.get("retry_count", 0)
        retrieved_docs = final_state.get("retrieved_documents", [])
        rewritten_q = final_state.get("rewritten_question")
        relevance_score = final_state.get("relevance_score", 0.0)

        # 3. Format source citations
        citations = []
        for s in raw_sources:
            citations.append(SourceCitation(
                document=s.get("document", ""),
                document_id=s.get("document_id"),
                page=s.get("page"),
                sheet=s.get("sheet"),
                section=s.get("section"),
                row_range=s.get("row_range"),
                chunk_id=s.get("chunk_id"),
                snippet=s.get("snippet"),
            ))

        # 4. Save assistant reply in conversation if active
        if conversation:
            serialized_sources = json.dumps([c.model_dump() for c in citations])
            assistant_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=answer,
                sources=serialized_sources
            )
            db.add(assistant_msg)
            # Auto-title conversation from first question if default
            if conversation.title == "New Conversation" and question:
                conversation.title = (question[:40] + "...") if len(question) > 40 else question
            db.commit()

        return ChatResponse(
            answer=answer,
            sources=citations,
            metadata=ChatMetadata(
                retry_count=retry_count,
                retrieved_chunk_count=len(retrieved_docs),
                rewritten_query=rewritten_q,
                relevance_score=relevance_score,
            ),
            conversation_id=conversation_id,
        )

rag_service = RAGService()
