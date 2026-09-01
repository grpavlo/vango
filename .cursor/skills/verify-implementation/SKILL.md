# Verify Implementation

Use this skill after implementation from a saved plan in `10-Projects/plans/`.
The implementer must not self-certify completion before this workflow finishes.

## Inputs

- Saved planning brief.
- List of touched files.
- New or changed tests.
- User opt-outs, if any.

## Workflow

Run steps sequentially:

1. Read the saved planning brief, especially Sections 2, 8, and 10.
2. Identify touched modules and new test files.
3. Run scope-targeted shell checks from the plan verification scope.
4. Run a static review unless the user opted out.
5. Post the verification report using the template below.
6. Confirm the verification complete gate.
7. If all gate rows are true and the user did not request verify-only, post the
   implementation agenda.

Do not auto-fix failures unless the user asks after seeing the reports.

## Verification Report Template

```markdown
## Verification report

| Gate | Status | Evidence |
| --- | --- | --- |
| Plan success criteria checked | true/false | ... |
| Scope-targeted tests/checks run | true/false | ... |
| Static review completed or opted out | true/false | ... |
| Failures and risks disclosed | true/false | ... |
| No unreviewed blockers remain | true/false | ... |

### Checks

- `command`: result

### Findings

- None / finding with file reference

### Result

Ready for implementation agenda / blocked until follow-up.
```

## Implementation Agenda Template

```markdown
## Implementation agenda

### Done

- ...

### Changed files

- `path`: summary

### Verification

- ...

### Follow-ups

- ...
```
