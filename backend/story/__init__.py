"""Story Studio: develop a story one stage at a time, the writer approving every stage. Approved stages are canon:
they go into the Story Bible, and every later stage, the final story and the screenplay must stay consistent with them.
  options.py     the choices (content types, genres, ...) and the stage table
  bible.py       the Story Bible: approved facts and the writer's directions
  checks.py      objective checks on a story (length, language, cast, repetition)
  validation.py  the pass/fail rules for the validator's report (decided in code, not by the model)
  fountain.py    screenplay helpers (Fountain format)
  prompts.py     what the model is asked, for every step
  llm.py         the only place that talks to the model
  engine.py      the workflow: stages, review gate, story, validation and repair, revisions, screenplay
  jobs.py        long steps run in the background with progress
  store.py       the database
"""
