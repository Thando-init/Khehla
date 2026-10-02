# Gemini compatibility notes

The uploaded repository already supported Gemini through its existing OpenAI-compatible provider configuration. That implementation is preserved in `backend/ai/provider.py`; this project does not add a separate `GeminiProvider` or `GEMINI_*` environment-variable contract.

Use the existing settings in the backend environment:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=<Gemini API key>
OPENAI_MODEL=<Gemini model enabled for the API project>
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

The frontend must never receive the API key. The deterministic demo provider remains the default when `AI_PROVIDER=demo` is selected. The implementation and structured-output behavior are intentionally kept as supplied; this note does not claim that the Gemini endpoint was re-tested against the partner's project credentials.

Official references:

- [Gemini API OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
