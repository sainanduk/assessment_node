const redis = require("../config/redis");
const { Institute } = require("../models");

const INSTITUTE_CHANNEL = "institute-events";

redis.subscribe(INSTITUTE_CHANNEL, (err, count) => {
  if (err) return console.error("Failed to subscribe to institute events:", err);
  console.log(`Subscribed to ${INSTITUTE_CHANNEL} (${count} total subscriptions)`);
});

redis.on("message", async (channel, message) => {
  if (channel !== INSTITUTE_CHANNEL) return;

  try {
    const { action, data } = JSON.parse(message);
    switch (action) {
      case "created": {
        const exists = await Institute.findByPk(data.id);
        if (!exists) {
          await Institute.create(data);
          console.log("Institute created:", data.id);
        } else {
          console.log("Institute already exists, skipping create:", data.id);
        }
        break;
      }
      case "updated": {
        const inst = await Institute.findByPk(data.id);
        if (inst) {
          await Institute.update(data, { where: { id: data.id } });
          console.log("Institute updated:", data.id);
        } else {
          console.log("Institute not found, cannot update:", data.id);
        }
        break;
      }
      case "deleted": {
        const inst = await Institute.findByPk(data.id);
        if (inst) {
          await Institute.destroy({ where: { id: data.id } });
          console.log("Institute deleted:", data.id);
        } else {
          console.log("Institute not found, cannot delete:", data.id);
        }
        break;
      }
      default:
        console.warn("Unknown institute event action:", action);
    }
  } catch (err) {
    console.error("Error processing institute event:", err);
  }
});
