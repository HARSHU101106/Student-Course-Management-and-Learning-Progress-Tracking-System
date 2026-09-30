import { Router } from "express";

const router = Router();
const notifications = [
  { id: 1, text: "Your study plan is ready.", unread: true, time: "2 hours ago" },
  { id: 2, text: "Normalization quiz is due Friday.", unread: true, time: "Yesterday" },
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

export default router;
