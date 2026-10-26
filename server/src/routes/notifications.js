import { Router } from "express";

const router = Router();
const notifications = [
  { id: 1, text: "Your study plan is ready.", unread: true, time: "2 hours ago" },
  { id: 2, text: "Normalization quiz is due Friday.", unread: true, time: "Yesterday" },
  { id: 3, text: "Operating Systems was added to the catalog.", unread: false, time: "2 days ago" },
];

router.get("/", (_request, response) => {
  response.json({ items: notifications });
});

router.patch("/read-all", (_request, response) => {
  notifications.forEach((item) => {
    item.unread = false;
  });
  response.json({ items: notifications });
});

router.patch("/:id/read", (request, response) => {
  const notification = notifications.find((item) => item.id === Number(request.params.id));
  if (!notification) {
    return response.status(404).json({ message: "Notification not found." });
  }

  notification.unread = false;
  return response.json({ item: notification });
});

export default router;
