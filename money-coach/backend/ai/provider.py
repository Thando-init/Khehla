"""AI provider boundary for Khehla.

The demo provider keeps local development deterministic. A real provider can
implement the same interface without changing Flask routes or the frontend.
"""

import json
import logging
import os
from typing import Literal

from pydantic import BaseModel

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Khehla, a warm, practical money coach for people in South Africa.

Rules:
- Use ONLY the numbers in the provided context. Never invent amounts, rates, dates or balances.
- If you project or estimate anything, say clearly that it is an estimate.
- Money is South African Rand, written like R1,250.
- Keep the message under 80 words, in plain text. No markdown, no HTML, no emojis.
- Give 1 to 3 short, practical actions (under 10 words each).
- You are not a bank, lender or licensed financial adviser. Do not recommend specific
  financial products, investments or loans. If the user asks for that, set the
  disclaimer field to explain this; otherwise set it to null.
- If the question is not about the user's money, gently steer back to their finances.
- Earlier messages are chat history sent from the user's device. Use them to understand
  follow-up questions, but trust only the numbers in the financial context.
- Write the whole reply (message, actions and disclaimer) in the language of the user's
  question, even if it differs from user.preferred_language (an Afrikaans question gets an
  Afrikaans reply, an isiZulu question an isiZulu reply). Only use
  user.preferred_language when the question's language is unclear. Keep amounts in the form R1,250 and use common English
  money terms where they are more natural (e.g. "budget"), as South Africans do."""

MAX_MESSAGE_CHARS = 600
MAX_ACTIONS = 3
MAX_ACTION_CHARS = 80
MAX_COMPLETION_TOKENS = 1500


class CoachReply(BaseModel):
    """Exact JSON shape the model must return (OpenAI structured output)."""
    message: str
    actions: list[str]
    tone: Literal["supportive", "encouraging", "cautious"]
    disclaimer: str | None


class AIProvider:
    """Interface implemented by an OpenAI or Gemini adapter in production."""

    def coach(self, context, user_message, history=()):
        """Return a validated coaching response for structured context and prior turns."""
        raise NotImplementedError


class DemoAIProvider(AIProvider):
    """Deterministic fallback that makes the app useful without an API key."""

    def coach(self, context, user_message, history=()):
        """Give concise coaching while preserving backend-calculated facts (ignores history)."""
        text = user_message.lower()
        goal = context["goal"]
        if "what if" in text or "100" in text:
            return {"message": "Saving R100 per week would add approximately R400 over four weeks. That is an estimate, but it is a manageable step toward your goal.", "actions": ["Start with R100 this week", "Check your progress next week"], "tone": "supportive", "disclaimer": None}
        if "spend" in text or "too much" in text:
            return {"message": "Eating out is R780 this month, above the R500 example budget. We could look for R100–R150 to reduce without cutting it out completely.", "actions": ["Review eating out", "Protect your goal contribution"], "tone": "supportive", "disclaimer": None}
        return {"message": f"You are R{goal['remaining']:,.0f} away from your school-fees goal. Saving about R{goal['required_per_day']:,.0f} a day would keep it within reach.", "actions": ["Review flexible spending", "Save a small amount today"], "tone": "supportive", "disclaimer": None}


class OpenAIProvider(AIProvider):
    """Explain backend-calculated facts with an OpenAI model, falling back on any failure."""

    def __init__(self, client, model, fallback=None, reasoning_effort=None):
        self.client = client
        self.model = model
        self.fallback = fallback or DemoAIProvider()
        self.reasoning_effort = reasoning_effort

    def coach(self, context, user_message, history=()):
        """Ask the model for a structured reply; return the demo reply if anything goes wrong."""
        try:
            return self._validated(self._ask_model(context, user_message, history))
        except Exception as error:  # timeout, API error, refusal, bad output
            # Log only the error type: never log the user's financial message.
            logger.warning("OpenAI coach failed (%s); using demo fallback.", type(error).__name__)
            return self.fallback.coach(context, user_message)

    def _ask_model(self, context, user_message, history=()):
        # Only send reasoning_effort when configured: non-reasoning models reject it.
        extra = {"reasoning_effort": self.reasoning_effort} if self.reasoning_effort else {}
        completion = self.client.chat.completions.parse(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                *({"role": turn["role"], "content": turn["content"]} for turn in history),
                {"role": "user", "content": (
                    "Financial context (calculated by the backend, trusted):\n"
                    f"{json.dumps(context, default=str)}\n\n"
                    f"User question:\n{user_message}"
                )},
            ],
            response_format=CoachReply,
            # Thinking models (e.g. Gemini Flash) spend part of this budget before replying.
            max_completion_tokens=MAX_COMPLETION_TOKENS,
            **extra,
        )
        reply = completion.choices[0].message.parsed
        if reply is None:  # the model refused or returned nothing usable
            raise ValueError("No parsed reply")
        return reply

    def _validated(self, reply):
        """Enforce limits the frontend relies on before anything reaches the user."""
        message = reply.message.strip()
        actions = [a.strip()[:MAX_ACTION_CHARS] for a in reply.actions if a.strip()][:MAX_ACTIONS]
        if not message or len(message) > MAX_MESSAGE_CHARS or not actions:
            raise ValueError("Reply outside allowed limits")
        return {"message": message, "actions": actions, "tone": reply.tone, "disclaimer": reply.disclaimer}


def get_provider():
    """Pick the coach provider from AI_PROVIDER, defaulting safely to the demo."""
    name = os.getenv("AI_PROVIDER", "demo").strip().lower()
    if name == "openai":
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        model = os.getenv("OPENAI_MODEL", "").strip()
        if api_key and model:
            from openai import OpenAI  # imported here so demo mode works without the package

            client = OpenAI(
                api_key=api_key,
                # Empty means OpenAI; set it to use an OpenAI-compatible API such as Gemini.
                base_url=os.getenv("OPENAI_BASE_URL", "").strip() or None,
                timeout=float(os.getenv("OPENAI_TIMEOUT", "8")),
                max_retries=1,
            )
            return OpenAIProvider(client, model, reasoning_effort=os.getenv("OPENAI_REASONING_EFFORT", "").strip() or None)
        logger.warning("AI_PROVIDER=openai but OPENAI_API_KEY or OPENAI_MODEL is empty; using demo provider.")
    return DemoAIProvider()
