from backend.app.graph.state import RAGState
from backend.app.core.logging import logger

def decide_next_step(state: RAGState) -> str:
    """
    Conditional routing function:
    - If needs_rewrite is True: branch to rewrite_query
    - If needs_rewrite is False: branch to generate_answer
    """
    if state.get("needs_rewrite", False):
        logger.info("Router: Quality poor and retry available -> Routing to 'rewrite_query'")
        return "rewrite_query"
    logger.info("Router: Quality acceptable or retry limit reached -> Routing to 'generate_answer'")
    return "generate_answer"
