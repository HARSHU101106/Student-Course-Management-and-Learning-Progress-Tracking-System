export function registerTutorSocket(io) {
  io.on("connection", (socket) => {
    socket.on("tutor:question", (payload, acknowledgement) => {
      const question = typeof payload === "string" ? payload : payload?.question || "";
      if (!question.trim()) {
        if (typeof acknowledgement === "function") acknowledgement({ ok: false, error: "Question is required." });
        return;
      }

      const answer = "Review the relevant lecture segment and focus on the key concept before taking the quiz.";
      const response = { answer, citations: [{ lesson: "Course overview", timestamp: 0 }] };
      socket.emit("tutor:answer", response);
      if (typeof acknowledgement === "function") acknowledgement({ ok: true, response });
    });
  });
}
