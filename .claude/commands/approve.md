---
description: The author approves the current file of the active task (spec.md, then design.md, then plan.md). Only the author can run this.
argument-hint: "[spec|design|plan]"
disable-model-invocation: true
---

# /approve

The author typed /approve $ARGUMENTS. The UserPromptSubmit hook (`.claude/hooks/on-prompt.cjs`) has already written the approval line, or it explained why it could not. Its message is in your context.

1. Run `node .claude/hooks/task.cjs status` from the repo root, and quote the status line of the file that was approved.
2. If the hook approved nothing, say why in one line and what the author can do.
3. Name the next command: after the spec, /design (light mode: /implement); after the design, /plan; after the plan, /implement.
4. Do not edit any status line, and do not start the next step yourself. The author starts it.
