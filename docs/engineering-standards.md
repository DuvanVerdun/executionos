# ExecutionOS — Engineering Standards

## Purpose

ExecutionOS is both a real product and deliberate Product Engineering training.

The objective is not merely to produce working software.

The objective is to develop:

- Engineering judgment.
- Product judgment.
- Ownership.
- Debugging ability.
- Systems thinking.
- Precision.
- Clear communication.
- Fast learning.
- Attention to detail.

These are target standards to grow toward, not a claim that every part of the current codebase already satisfies them.

## Ownership

Own work end-to-end:

Problem → Reasoning → Design → Implementation → Verification → Production → Feedback → Iteration

Do not stop at:

"It works."

Understand:

- Why it works.
- What assumptions it depends on.
- What could fail.
- How it was verified.
- How it affects the rest of the system.

If something breaks, investigate the mechanism rather than applying fixes blindly.

## Engineering Judgment

Prefer:

- Simple solutions before complex ones.
- Existing patterns before introducing new ones.
- Clear responsibility boundaries.
- Maintainability over cleverness.
- Verification over assumptions.
- Understanding mechanisms over memorizing fixes.
- Refactoring when real complexity creates real friction.

Avoid:

- Premature abstractions.
- Premature optimization.
- Solving hypothetical problems.
- Introducing technology without a concrete need.
- Changing architecture only because another pattern is fashionable.
- Expanding the scope of a task unnecessarily.

Complexity must justify itself.

## Product Judgment

Engineering decisions exist to serve the product and its users.

For meaningful changes, understand:

1. What problem exists?
2. Why does it matter?
3. What behavior should change?
4. Why should this solution improve that behavior?
5. What complexity or trade-offs does it introduce?
6. How will we know whether it worked?

Features are not valuable simply because they exist.

They are valuable when they improve the user's ability to execute consistently.

## Precision

Treat details as part of engineering quality.

Pay attention to:

- Naming.
- Types.
- Architecture.
- State ownership.
- Error handling.
- Edge cases.
- Security.
- Accessibility.
- UI behavior.
- Visual consistency.
- Documentation.
- Tests.

"Close enough" should be a deliberate trade-off, not the default.

## Debugging

Debug systematically.

Preferred loop:

1. Reproduce the problem.
2. Observe the actual behavior.
3. Narrow the failing system.
4. Form a hypothesis.
5. Test the hypothesis.
6. Change the smallest relevant thing.
7. Verify the result.

Do not modify code merely because a theory sounds plausible.

Avoid changing several variables simultaneously when trying to understand one failure.

## Testing

Tests exist to provide evidence about behavior and protect important functionality from regressions.

Prioritize tests around behavior where failure would matter.

Examples include:

- Authentication.
- Authorization and ownership.
- Sessions.
- Timer logic.
- Dashboard calculations.
- Data transformations.
- Important edge cases.

Test observable behavior rather than implementation details when possible.

A passing test suite does not replace understanding or manual verification when the real product behavior also needs inspection.

## Type Safety

Python code should maintain strict Pylance compliance.

Zero type errors is the baseline.

Types should clarify the system rather than silence the checker.

Use `cast()` only when crossing genuine typing boundaries or compensating for known limitations in external type information.

Do not use typing tools to hide unclear application logic.

## Code Quality

Code should be understandable by another engineer without requiring unnecessary mental reconstruction.

Prefer:

- Clear names.
- Small coherent responsibilities.
- Explicit state.
- Predictable control flow.
- Consistent patterns.
- Simple interfaces.

Avoid clever code when straightforward code communicates the same intent more clearly.

## Refactoring

Refactor because existing structure is producing concrete friction.

Good reasons include:

- Repeated bugs.
- Difficult testing.
- Confusing responsibilities.
- Significant duplication.
- Difficult modifications.
- Established patterns becoming inconsistent.

Do not refactor merely because a different abstraction appears theoretically cleaner.

Separate refactoring from unrelated feature work when combining them would make verification harder.

## Communication

If a technical or product decision cannot be explained simply, the understanding is probably incomplete.

Communicate:

- The problem.
- The mechanism.
- The decision.
- The reasoning.
- The trade-offs.
- The verification.

Complex systems do not justify unnecessarily complex explanations.

## Learning

Use real product problems as the trigger for learning.

Preferred loop:

1. Encounter a problem.
2. Understand the problem.
3. Learn the relevant mechanism.
4. Reason about possible approaches.
5. Implement.
6. Verify.
7. Get feedback.
8. Apply what was learned.

Prefer just-in-time learning over collecting technologies without application.

## AI-Native Engineering

AI is an engineering tool and implementation partner, not a substitute for ownership.

AI may:

- Inspect the repository.
- Explain unfamiliar code.
- Generate implementation.
- Refactor requested areas.
- Review diffs.
- Identify risks.
- Suggest tests.
- Help debug.
- Explain tools and concepts.

The human Product Engineer remains responsible for:

- Defining the problem.
- Choosing product priorities.
- Evaluating important trade-offs.
- Reviewing meaningful changes.
- Understanding important mechanisms.
- Verifying behavior.
- Shipping the result.
- Owning failures.

Preferred workflow:

Define → Delegate → Review → Understand → Verify → Ship → Learn

Do not judge AI-generated code by whether it looks plausible.

Judge it by whether it is understandable, consistent with the system, and demonstrably correct.

## Speed

Move quickly without sacrificing understanding or system integrity.

Speed should come from:

- Better feedback loops.
- Clearer scope.
- Good tooling.
- AI leverage.
- Existing patterns.
- Automated verification.
- Better judgment.

It should not come from accepting changes that have not been understood or tested.

## Fundamental Standard

Build software that is simple enough to understand, reliable enough to trust, and structured well enough to change.

The codebase should improve while the engineer building it improves with it.