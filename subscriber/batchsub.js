const redis = require("../config/redis");
const { Batch } = require("../models");

const BATCH_CHANNEL = "batch-events";

redis.subscribe(BATCH_CHANNEL, (err, count) => {
  if (err) return console.error("Failed to subscribe to batch events:", err);
  console.log(`Subscribed to ${BATCH_CHANNEL} (${count} total subscriptions)`);
});

redis.on("message", async (channel, message) => {
  if (channel !== BATCH_CHANNEL) return;

  try {
    const { action, data } = JSON.parse(message);
    switch (action) {
      case "created": {
        const exists = await Batch.findByPk(data.id);
        if (!exists) {
          await Batch.create(data);
          console.log("Batch created:", data.id);
        } else {
          console.log("Batch already exists, skipping create:", data.id);
        }
        break;
      }
      case "updated": {
        const batch = await Batch.findByPk(data.id);
        if (batch) {
          await Batch.update(data, { where: { id: data.id } });
          console.log("Batch updated:", data.id);
        } else {
          console.log("Batch not found, cannot update:", data.id);
        }
        break;
      }
      case "deleted": {
        const batch = await Batch.findByPk(data.id);
        if (batch) {
          await Batch.destroy({ where: { id: data.id } });
          console.log("Batch deleted:", data.id);
        } else {
          console.log("Batch not found, cannot delete:", data.id);
        }
        break;
      }
      default:
        console.warn("Unknown batch event action:", action);
    }
  } catch (err) {
    console.error("Error processing batch event:", err);
  }
});
