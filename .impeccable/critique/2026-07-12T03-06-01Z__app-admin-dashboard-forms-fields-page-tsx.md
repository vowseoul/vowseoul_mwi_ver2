---
target: app/admin/(dashboard)/forms/fields/page.tsx
total_score: 32
p0_count: 0
p1_count: 2
timestamp: 2026-07-12T03-06-01Z
slug: app-admin-dashboard-forms-fields-page-tsx
---
# Design Critique: Form Fields & Templates Administration

This critique covers the user experience of the new wedding form-builder, field block configurations, and customer version update screens.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Form preview does not explicitly state the version being previewed. |
| 2 | Match System / Real World | 4 | Solid domain-appropriate terminology ("혼주 정보", "축의 계좌"). |
| 3 | User Control and Freedom | 3 | Exiting the block field editor does not warn about unsaved changes. |
| 4 | Consistency and Standards | 4 | Clean implementation of standard tailwind design components. |
| 5 | Error Prevention | 2 | Lack of confirmation prompts on field deletions inside block configurations. |
| 6 | Recognition Rather Than Recall | 4 | Dependent question dropdowns filter preceding fields to prevent circular references. |
| 7 | Flexibility and Efficiency | 3 | Uses manual arrow keys for sorting rather than drag-and-drop handlers. |
| 8 | Aesthetic and Minimalist Design | 4 | Excellent spacing and structure with the new full-screen inline layout. |
| 9 | Error Recovery | 3 | Standard React validation and validation status displays. |
| 10 | Help and Documentation | 2 | Conditional sub-question rules lack contextual hover guides or descriptions. |
| **Total** | | **32/40** | **Good** (address weak areas, solid foundation) |

---

## Anti-Patterns Verdict
**PASS.** The interface feels extremely clean, highly professional, and task-focused, mimicking modern tools like Notion or Linear. It avoids generic SaaS slop aesthetics, gradient titles, and decorative visual clutter.

---

## Overall Impression
The full-screen block editor has transformed what was a frustrating, cramped dialog into a highly comfortable workspace. However, several critical safeguards (unsaved changes prompts, deletion warnings) are missing, which could cause accidental data loss for busy admins.

---

## What's Working
1. **Collapsible Inline Linking**: Placing conditional sub-question logic directly in a sub-row preserves context and keeps table layout uncluttered.
2. **Context-Aware Fields Filter**: Preventing circular dependency by slicing the field index guarantees that admins cannot create broken cyclical rules.
3. **Version Comparison Alert**: The automatic diff check between customer snapshot and current template makes update delivery highly visual and reassuring.

---

## Priority Issues

### [P1 Major] Risk of data loss on exiting Block Editor with unsaved changes
- **Location**: `app/admin/(dashboard)/forms/fields/page.tsx`
- **Why it matters**: If an admin spends time configuring multiple fields and sub-question links and accidentally clicks "이전으로" (Go Back) or navigates away, all changes are instantly discarded without a warning.
- **Fix**: Check if `blockFields` state differs from the initial state, and show a confirmation prompt when navigating away or clicking go back.
- **Suggested command**: `/impeccable harden`

### [P1 Major] Unintentional field deletions inside a block
- **Location**: `app/admin/(dashboard)/forms/fields/page.tsx`
- **Why it matters**: Clicking the red trash button instantly removes the field and its configuration. There is no undo or confirmation modal, making accidental clicks destructive.
- **Fix**: Show a confirmation dialog or toast with an "Undo" action.
- **Suggested command**: `/impeccable harden`

### [P2 Minor] Lack of explanation for "Conditional Logic" (하위 연동)
- **Location**: `app/admin/(dashboard)/forms/fields/page.tsx`
- **Why it matters**: Novice administrators may not understand how conditional logic works or what "Trigger Option" means.
- **Fix**: Add a small Info tooltip or explanatory label explaining that the field will only be shown to customers when the parent field matches the trigger value.
- **Suggested command**: `/impeccable clarify`

### [P3 Polish] Manual sort order buttons
- **Location**: `app/admin/(dashboard)/forms/fields/page.tsx`
- **Why it matters**: Clicking up/down arrows repeatedly is slow for large blocks.
- **Fix**: Eventually replace or augment with drag-and-drop handles.
- **Suggested command**: `/impeccable layout`

---

## Persona Red Flags

**Alex (Power User)**: Keyboard shortcut support is missing for quick saving or adding fields, forcing multiple precise mouse clicks. Manual sorting via Arrow buttons is slow compared to dragging or keyboard reordering.

**Jordan (First-Timer)**: Finding "Trigger Option" under sub-question link without a tooltip makes Jordan hesitate. Jordan doesn't know if "on" is the only option for toggle fields or what options to type.

---

## Minor Observations
- The page heading "필드 라이브러리 및 블록 관리" could use a breadcrumb link to make navigation clearer.
