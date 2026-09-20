from typing import List, Dict, Any, Optional
from langgraph.graph import StateGraph, START, END
from backend.app.graph.state import RAGState
from backend.app.graph.nodes import (
    analyze_query,
    retrieve_documents,
    evaluate_relevance,
    rewrite_query,
    generate_answer,
)
from backend.app.graph.router import decide_next_step
from backend.app.core.logging import logger

def build_rag_workflow():
    workflow = StateGraph(RAGState)

    # 1. Add nodes
    workflow.add_node("analyze_query", analyze_query)
    workflow.add_node("retrieve_documents", retrieve_documents)
    workflow.add_node("evaluate_relevance", evaluate_relevance)
    workflow.add_node("rewrite_query", rewrite_query)
    workflow.add_node("generate_answer", generate_answer)

    # 2. Add edges
    workflow.add_edge(START, "analyze_query")
    workflow.add_edge("analyze_query", "retrieve_documents")
    workflow.add_edge("retrieve_documents", "evaluate_relevance")

    # 3. Conditional routing based on relevance
    workflow.add_conditional_edges(
        "evaluate_relevance",
        decide_next_step,
        {
            "rewrite_query": "rewrite_query",
            "generate_answer": "generate_answer",
        }
    )

    # Loop back from rewrite to retrieval
    workflow.add_edge("rewrite_query", "retrieve_documents")
    workflow.add_edge("generate_answer", END)

    return workflow.compile()

# Singleton compiled graph
agentic_rag_graph = build_rag_workflow()

def run_agentic_rag(
    question: str,
    user_id: str,
    document_ids: Optional[List[str]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Executes the full agentic RAG workflow with query analysis, vector retrieval,
    relevance evaluation, adaptive query rewriting, and grounded generation.
    """
    initial_state: RAGState = {
        "question": question,
        "rewritten_question": None,
        "retrieved_documents": [],
        "relevant_documents": [],
        "answer": "",
        "sources": [],
        "retry_count": 0,
        "needs_rewrite": False,
        "document_ids": document_ids or [],
        "user_id": user_id,
        "conversation_history": conversation_history or [],
        "relevance_score": 0.0,
    }

    logger.info(f"Executing Agentic RAG for User '{user_id}' with question: '{question}'")
    final_state = agentic_rag_graph.invoke(initial_state)
    return final_state
