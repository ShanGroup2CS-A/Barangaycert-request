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
| Backend Authentication | #1 | `Commit: 05b3a3a` | Done |
| Certificate Request Services | #2 | `Commit: 70d75d3` | Done |
| Request Services (CRUD) | #3 | `Commit: 241c564` | Done |
| Fronted UI & .htaccess | #4 | `Commit: c16500b` | Done |
| Service Authentication | #5 | `Commit: 05b3a3a` | Done |
| Certificate Services | #6 | `Commit: u6v7w8x` | Done |

•Lessons Learned
Process Improvement: In future sprints or projects, the Project Board will be utilized from Day 1 to ensure real-time tracking of tasks and commits. 

•Documentation: We learned that documenting features at the moment they are completed (rather than at the end of the project) saves time and ensures accurate traceability between user stories and source code.
Agile Adaptation:The team successfully adapted to a commit-driven workflow, ensuring that all major backend and frontend components were tracked and integrated efficiently.
