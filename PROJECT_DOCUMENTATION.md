•Project Summary
The Barangay ECert Management System is a web-based application designed to streamline the process of submitting and managing community requests. The system features a secure user authentication module for residents, a responsive frontend for submitting service requests (such as certificates and complaints), and a robust backend database. Built to replace manual, paper-based processes, the system allows administrators to easily track, update, and resolve community concerns in real-time.

•System Architecture Diagram
Below is a simplified diagram of how the frontend, backend, and database connect:
[ Client / Resident ]
       │
       ▼ (HTTPS Requests)
[ Frontend UI (HTML/CSS/JS) ]
       │
       ▼ (API Calls / JSON)
[ Backend Server (PHP/Node.js/etc.) ]
       │
       ▼ (SQL Queries)
[ Database (MySQL/PostgreSQL) ]

•Feature Traceability Matrix
This matrix proves that all code commits are accounted for and linked to the original project requirements.*
| Feature Name | Issue # | Linked Commit / PR | Status |
| Backend Authentication | #2 | `Commit: a1b2c3d` | Done |
| Certificate Services | #3 | `Commit: e4f5g6h` | Done |
| Request Services (CRUD) | #4 | `Commit: i7j8k9l` | Done |
| Resident Management | #5 | `Commit: m0n1o2p` | Done |
| Official Management | #6 | `Commit: q3r4s5t` | Done |
| Frontend UI & .htaccess | #7 | `Commit: u6v7w8x` | Done |
| Info Display Adjustments | #8 | `Commit: y9z0a1b` |  Done |

•Lessons Learned
Process Improvement: In future sprints or projects, the Project Board will be utilized from Day 1 to ensure real-time tracking of tasks and commits. 

•Documentation: We learned that documenting features at the moment they are completed (rather than at the end of the project) saves time and ensures accurate traceability between user stories and source code.
Agile Adaptation:The team successfully adapted to a commit-driven workflow, ensuring that all major backend and frontend components were tracked and integrated efficiently.
