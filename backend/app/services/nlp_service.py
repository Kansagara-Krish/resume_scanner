import io
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
from app.services.ai_service import AIService
from app.services.parsing_service import ParsingService

logger = logging.getLogger(__name__)


class NLPService:
    _instance = None
    _bert_model = None
    _skill_suggestion_cache: Dict[str, Tuple[float, List[str]]] = {}
    _skill_suggestion_ttl_seconds = 1800

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(NLPService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.ai_service = AIService()
        self._parser = ParsingService()
        self._initialized = True

    def extract_text_from_bytes(self, content: bytes, filename: str) -> str:
        return self._parser.extract_text_from_bytes(content, filename)

    @classmethod
    def get_bert_model(cls):
        if cls._bert_model is None:
            logger.info("Loading BERT model...")
            from sentence_transformers import SentenceTransformer
            cls._bert_model = SentenceTransformer('all-MiniLM-L6-v2')
        return cls._bert_model

    async def extract_candidate_profile(self, text: str, filename: str = "") -> Dict[str, Any]:
        return await self.ai_service.extract_candidate_profile(text, filename)

    async def extract_skills(self, text: str) -> Set[str]:
        return await self.ai_service.extract_skills(text)

    async def analyze_candidate(self, resume_text: str, job_description: str, model_type: str = "ensemble") -> Dict[str, any]:
        return await self.ai_service.analyze_candidate(resume_text, job_description, model_type=model_type)

    async def get_professional_insights(self, combined_text: str, role_title: Optional[str] = None) -> Dict[str, any]:
        return await self.ai_service.get_professional_insights(combined_text, role_title)

    async def generate_chat_response(
        self,
        user_message: str,
        conversation_history: List[str],
        context_data: str = "",
    ) -> str:
        return await self.ai_service.generate_chat_response(user_message, conversation_history, context_data=context_data)

    async def suggest_skills_for_role(self, role_title: str, role_description: str = "") -> List[str]:
        cache_key = f"{role_title}:{role_description}"
        now = time.time()
        cached = self._skill_suggestion_cache.get(cache_key)
        if cached and now - cached[0] <= self._skill_suggestion_ttl_seconds:
            return list(cached[1])

        suggestions = await self.ai_service.suggest_skills_for_role(role_title, role_description)
        self._skill_suggestion_cache[cache_key] = (now, suggestions)
        return suggestions

    def score_tfidf(self, resume_text: str, job_description: str) -> float:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        if not resume_text or not job_description:
            return 0.0
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf = vectorizer.fit_transform([resume_text, job_description])
        return float(cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0])

    def score_bert(self, resume_text: str, job_description: str) -> float:
        from sklearn.metrics.pairwise import cosine_similarity
        model = self.get_bert_model()
        embeddings = model.encode([resume_text, job_description])
        return float(cosine_similarity([embeddings[0]], [embeddings[1]])[0][0])


