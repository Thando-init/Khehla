"""AI provider boundary for Khehla.

The demo provider keeps local development deterministic. A real provider can
implement the same interface without changing Flask routes or the frontend.
"""


class AIProvider:
    """Interface implemented by an OpenAI or Gemini adapter in production."""

    def coach(self, context, user_message):
        """Return a validated coaching response for structured context."""
        raise NotImplementedError


class DemoAIProvider(AIProvider):
    """Deterministic fallback that makes the app useful without an API key."""

    def coach(self, context, user_message):
        """Give concise coaching while preserving backend-calculated facts."""
        text = user_message.lower()
        goal = context["goal"]
        if "what if" in text or "100" in text:
            return {"message": "Saving R100 per week would add approximately R400 over four weeks. That is an estimate, but it is a manageable step toward your goal.", "actions": ["Start with R100 this week", "Check your progress next week"], "tone": "supportive", "disclaimer": None}
        if "spend" in text or "too much" in text:
            return {"message": "Eating out is R780 this month, above the R500 example budget. We could look for R100–R150 to reduce without cutting it out completely.", "actions": ["Review eating out", "Protect your goal contribution"], "tone": "supportive", "disclaimer": None}
        return {"message": f"You are R{goal['remaining']:,.0f} away from your school-fees goal. Saving about R{goal['required_per_day']:,.0f} a day would keep it within reach.", "actions": ["Review flexible spending", "Save a small amount today"], "tone": "supportive", "disclaimer": None}
