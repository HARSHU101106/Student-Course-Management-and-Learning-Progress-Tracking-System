# Architecture

AdaptLearn is split into a static frontend, a React client, an Express/Socket.IO application server, and a FastAPI AI service. The server owns authentication, persistence, and real-time notifications; the AI service owns tutor, planner, quiz, and studio workflows.
