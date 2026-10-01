"""Keep tests offline and deterministic regardless of the local .env."""

import os

os.environ["AI_PROVIDER"] = "demo"
