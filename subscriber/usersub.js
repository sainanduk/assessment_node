const redis = require("../config/redis");
const { Users } = require("../models");

const USER_CHANNEL = "user-events";

redis.subscribe(USER_CHANNEL, (err, count) => {
  if (err) return console.error("Failed to subscribe to user events:", err);
  console.log(`Subscribed to ${USER_CHANNEL} (${count} total subscriptions)`);
});

redis.on("message", async (channel, message) => {
  if (channel !== USER_CHANNEL) return;

  try {
    const { action, data } = JSON.parse(message);
    switch (action) {
      case "created": {
        const exists = await Users.findByPk(data.userId);
        if (!exists) {
          await Users.create(data);
          console.log("User created:", data.userId);
        } else {
          console.log("User already exists, skipping create:", data.userId);
        }
        break;
      }
      case "updated": {
        const user = await Users.findByPk(data.userId);
        if (user) {
          await Users.update(data, { where: { userId: data.userId } });
          console.log("User updated:", data.userId);
        } else {
          console.log("User not found, cannot update:", data.userId);
        }
        break;
      }
      case "deleted": {
        const user = await Users.findByPk(data.userId);
        if (user) {
          await Users.destroy({ where: { userId: data.userId } });
          console.log("User deleted:", data.userId);
        } else {
          console.log("User not found, cannot delete:", data.userId);
        }
        break;
      }
      default:
        console.warn("Unknown user event action:", action);
    }
  } catch (err) {
    console.error("Error processing user event:", err);
  }
});
