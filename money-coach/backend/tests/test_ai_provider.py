"""Unit tests for provider selection, validation and fallback (no network)."""

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ai.provider import CoachReply, DemoAIProvider, OpenAIProvider, get_provider  # noqa: E402

CONTEXT = {"goal": {"remaining": 650.0, "required_per_day": 22.0}}


def fake_client(parsed=None, error=None):
    """Build an object shaped like the OpenAI client's chat.completions.parse."""
    def parse(**_kwargs):
        if error:
            raise error
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=parsed))])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))


def test_defaults_to_demo(monkeypatch):
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    assert isinstance(get_provider(), DemoAIProvider)


def test_openai_without_key_falls_back_to_demo(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert isinstance(get_provider(), DemoAIProvider)


def test_valid_model_reply_is_returned():
    reply = CoachReply(message="You are R650 away.", actions=["Save R22 today"], tone="encouraging", disclaimer=None)
    body = OpenAIProvider(fake_client(parsed=reply), "test-model").coach(CONTEXT, "How am I doing?")
    assert body == {"message": "You are R650 away.", "actions": ["Save R22 today"], "tone": "encouraging", "disclaimer": None}


def test_api_error_falls_back_to_demo():
    body = OpenAIProvider(fake_client(error=TimeoutError()), "test-model").coach(CONTEXT, "How am I doing?")
    assert body["tone"] == "supportive" and "R650" in body["message"]


def test_refusal_or_oversized_reply_falls_back_to_demo():
    assert OpenAIProvider(fake_client(parsed=None), "m").coach(CONTEXT, "hi")["tone"] == "supportive"
    too_long = CoachReply(message="x" * 1000, actions=["a"], tone="supportive", disclaimer=None)
    assert "R650" in OpenAIProvider(fake_client(parsed=too_long), "m").coach(CONTEXT, "hi")["message"]


def test_base_url_and_reasoning_effort_are_configurable(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://example.test/v1/")
    monkeypatch.setenv("OPENAI_REASONING_EFFORT", "low")
    provider = get_provider()
    assert isinstance(provider, OpenAIProvider)
    assert str(provider.client.base_url) == "https://example.test/v1/"
    assert provider.reasoning_effort == "low"


def test_reasoning_effort_is_only_sent_when_configured():
    sent = []
    reply = CoachReply(message="ok", actions=["a"], tone="supportive", disclaimer=None)

    def parse(**kwargs):
        sent.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=reply))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))
    OpenAIProvider(client, "m").coach(CONTEXT, "hi")
    OpenAIProvider(client, "m", reasoning_effort="low").coach(CONTEXT, "hi")
    assert "reasoning_effort" not in sent[0]
    assert sent[1]["reasoning_effort"] == "low"


def test_history_is_sent_between_system_prompt_and_new_question():
    sent = []
    reply = CoachReply(message="ok", actions=["a"], tone="supportive", disclaimer=None)

    def parse(**kwargs):
        sent.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=reply))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))
    history = [{"role": "user", "content": "Am I on track?"}, {"role": "assistant", "content": "Yes, R650 to go."}]
    OpenAIProvider(client, "m").coach(CONTEXT, "And next week?", history)
    roles = [m["role"] for m in sent[0]["messages"]]
    assert roles == ["system", "user", "assistant", "user"]
    assert sent[0]["messages"][2]["content"] == "Yes, R650 to go."
    assert sent[0]["messages"][3]["content"].endswith("And next week?")
