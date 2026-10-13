# SwapCycle-SWEN
A community platform where student readers exchange physical books through direct two-way swaps and three-person exchange cycles, so that everyone receives a book they actually want. 

Course: SWEN360 – Software Design & Engineering Project status: Planning stage (no code written yet)

## Current Stage 

We are in the **planning and design phase**.

| Item | Status |
|---|---|
| Team formed and project idea chosen | Done |
| First team meeting (idea selection, Scrum Master assigned) | Done |
| Project outline reviewed | Done |
| High-level system architecture outlined | Done |
| Detailed design drafted (data model, matching, reservations) | Done |
| Functional task list (44 tasks across 10 areas) | Done |
| Product backlog and user stories | Not started |
| Sprint planning and task assignment | Not started |
| Kanban board setup | Not started |
| Implementation | Not started |

## Next Steps

1. Write user stories from the functional task list.
2. Prioritize the backlog and plan Sprint 1.
3. Set up the Kanban board and repository.
4. Assign tasks to team members.
5. Begin Sprint 1 (accounts, book listings, search).





## Planned Architecture 

SwapCycle will be built as a modular monolith: one backend with strictly separated modules. 

Key Design Decisions:

1. Book descriptions are modeled separately from physical copies, so different editions and conditions match correctly. 
2. Matching searches only cycles of length two or three and avoids duplicate proposals. 
3. Reservations use database transactions and expiry so one copy cannot join two confirmed exchanges. 
4. Each physical transfer is recorded separately, because handing over books cannot be atomic. 
5. Contact and meeting details are visible only to exchange participants. 
6. Matching is explainable, and new readers are never penalized for having no history. 
