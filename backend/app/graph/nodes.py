from typing import Dict, Any, List
from backend.app.graph.state import RAGState
from backend.app.services.embedding_service import embedding_service
from backend.app.services.vector_service import vector_service
from backend.app.services.gemini_service import gemini_service
from backend.app.core.logging import logger

def analyze_query(state: RAGState) -> Dict[str, Any]:
    """
    Analyzes and normalizes the user query, resolving conversational context if needed.
    """
    raw_question = state.get("question", "").strip()
    logger.info(f"LangGraph Node: analyze_query for '{raw_question}'")

    # Simple normalization
    normalized = " ".join(raw_question.split())
    return {
        "question": normalized,
        "retry_count": state.get("retry_count", 0),
        "needs_rewrite": False,
    }

def retrieve_documents(state: RAGState) -> Dict[str, Any]:
    """
    Generates query embedding and retrieves top-K candidate chunks from ChromaDB.
    """
    active_query = state.get("rewritten_question") or state.get("question", "")
    user_id = state.get("user_id", "")
    document_ids = state.get("document_ids", [])

    logger.info(f"LangGraph Node: retrieve_documents with query '{active_query}' for user '{user_id}' (Doc Filter: {document_ids})")

    query_embedding = embedding_service.embed_query(active_query)
    retrieved_chunks = vector_service.search(
        query_embedding=query_embedding,
        user_id=user_id,
        document_ids=document_ids if document_ids else None
    )

    logger.info(f"Retrieved {len(retrieved_chunks)} chunks from ChromaDB.")
    return {
        "retrieved_documents": retrieved_chunks
    }

def evaluate_relevance(state: RAGState) -> Dict[str, Any]:
    """
    Assesses retrieved chunk relevance against the user question.
    Decides whether query rewriting is required.
    """
    question = state.get("question", "")
    chunks = state.get("retrieved_documents", [])
    retry_count = state.get("retry_count", 0)

    eval_result = gemini_service.evaluate_relevance(question, chunks)
    is_relevant = eval_result.get("is_relevant", False)
    score = eval_result.get("score", 0.0)

    # Max retry count is 2 as specified in requirements
    max_retries = 2
    needs_rewrite = (not is_relevant) and (retry_count < max_retries)

    logger.info(
        f"LangGraph Node: evaluate_relevance -> Score={score}, Relevant={is_relevant}, "
        f"RetryCount={retry_count}/{max_retries}, NeedsRewrite={needs_rewrite}"
    )

    return {
        "relevance_score": score,
        "needs_rewrite": needs_rewrite,
        "relevant_documents": chunks if is_relevant else chunks,
    }

def rewrite_query(state: RAGState) -> Dict[str, Any]:
    """
    Rewrites the search query using Gemini to bridge vocabulary mismatch or resolve ambiguity.
    """
    question = state.get("question", "")
    history = state.get("conversation_history", [])
    current_retries = state.get("retry_count", 0)

    logger.info(f"LangGraph Node: rewrite_query (Attempt {current_retries + 1}) for '{question}'")

    rewritten = gemini_service.rewrite_query(
        question=question,
        conversation_history=history,
        reason="Initial retrieval had low similarity or keyword overlap."
    )

    logger.info(f"Query rewritten to: '{rewritten}'")

    return {
        "rewritten_question": rewritten,
        "retry_count": current_retries + 1,
        "needs_rewrite": False,
    }

def generate_answer(state: RAGState) -> Dict[str, Any]:
    """
    Generates a strictly grounded response citing source documents.
    """
    question = state.get("question", "")
    chunks = state.get("retrieved_documents", [])
    history = state.get("conversation_history", [])

    logger.info(f"LangGraph Node: generate_answer for question '{question}' using {len(chunks)} chunks")

    answer = gemini_service.generate_grounded_answer(
        question=question,
        context_chunks=chunks,
        conversation_history=history,
    )

    # Build structured source citations from retrieved chunks
    sources: List[Dict[str, Any]] = []
    seen_sources = set()

    for chunk in chunks:
        meta = chunk.get("metadata", {})
        doc_name = meta.get("filename") or meta.get("source") or "Document"
        chunk_id = meta.get("chunk_id")
        page = meta.get("page")
        sheet = meta.get("sheet")
        section = meta.get("section")
        row_range = meta.get("row_range")
        doc_id = meta.get("document_id")

        source_key = (doc_name, chunk_id, page, sheet, row_range)
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            snippet = (chunk.get("text", "")[:160] + "...") if len(chunk.get("text", "")) > 160 else chunk.get("text", "")
            sources.append({
                "document": doc_name,
                "document_id": doc_id,
                "page": int(page) if page is not None else None,
                "sheet": str(sheet) if sheet is not None else None,
                "section": str(section) if section is not None else None,
                "row_range": str(row_range) if row_range is not None else None,
                "chunk_id": chunk_id,
                "snippet": snippet,
            })

    return {
        "answer": answer,
        "sources": sources,
    }
