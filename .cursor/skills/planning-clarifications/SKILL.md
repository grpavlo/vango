# Planning Clarifications

Use this skill when a planning brief has unresolved blockers around scope,
product behavior, trade-offs, credentials, risk tolerance, wording, or phasing.

## Inputs

- User request.
- `templates/Agent-planning-brief.md`.
- Existing related notes or plans from `10-Projects/`, `10-Projects/plans/`,
  `20-Reference/`, and `25-AgentGraph/`.
- Targeted code evidence when needed.

## Workflow

1. Read the planning template completely.
2. Search for existing related plans and reference notes.
3. Separate verified facts from assumptions.
4. Turn any blocker into a concise user question.
5. If an AskQuestion-style tool is available, use it for blocker questions.
6. Batch related questions when possible.
7. Record answers in the planning brief under confirmed decisions.

## Ask When

- Multiple valid approaches exist.
- UX wording or product behavior is unclear.
- Scope boundaries are ambiguous.
- Credentials or environment values are needed.
- Risk tolerance or rollout phasing changes the implementation.

## Do Not Ask When

- The answer is verifiable from the vault or code.
- One repository convention is obvious from nearby files.
- The item is non-blocking and can be listed as a follow-up.

## Output

Return confirmed decisions, verified assumptions with evidence, remaining open
questions, and whether Section 5 blockers are empty.
