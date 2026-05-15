from typing import Any, Dict


class ScoringService:
    def build_candidate_insights(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        skills_count = len(profile.get("skills", []) or [])
        soft_skills_count = len(profile.get("soft_skills", []) or [])
        projects_count = int(profile.get("projects_count") or 0)
        certifications_count = len(profile.get("certifications", []) or [])
        awards_count = len(profile.get("awards", []) or [])
        has_linkedin = bool(profile.get("linkedin_url"))

        total_experience_years = profile.get("total_experience_years")
        try:
            experience_years = float(total_experience_years or 0)
        except (TypeError, ValueError):
            experience_years = 0.0

        score = (
            min(skills_count, 15) * 3.0
            + min(soft_skills_count, 10) * 1.0
            + min(projects_count, 8) * 2.0
            + min(experience_years, 12.0) * 5.0
            + min(certifications_count, 5) * 1.5
            + min(awards_count, 4) * 2.0
            + (5.0 if has_linkedin else 0.0)
        )

        candidate_score = round(min(100.0, score), 2)

        return {
            "candidate_score": candidate_score,
            "insight_summary": {
                "skills_count": skills_count,
                "soft_skills_count": soft_skills_count,
                "projects_count": projects_count,
                "certifications_count": certifications_count,
                "awards_count": awards_count,
                "has_linkedin": has_linkedin,
                "total_experience_years": experience_years,
            },
        }
