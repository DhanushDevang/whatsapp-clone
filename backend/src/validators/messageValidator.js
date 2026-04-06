const Joi = require("joi");

const sendMessageSchema = Joi.object({
  conversationId: Joi.number().integer().positive().required().messages({
    "any.required": "Conversation ID is required",
    "number.positive": "Invalid conversation ID",
  }),
  content: Joi.string().min(1).max(10000).required().messages({
    "string.min": "Message cannot be empty",
    "string.max": "Message is too long",
    "any.required": "Message content is required",
  }),
  message_type: Joi.string().valid("text", "image", "voice").default("text"),
  media_data: Joi.string().allow(null, "").optional(),
});

const conversationSchema = Joi.object({
  recipientId: Joi.number().integer().positive().required().messages({
    "any.required": "Recipient ID is required",
    "number.positive": "Invalid recipient ID",
  }),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((d) => d.message);
    return res.status(400).json({ message: "Validation failed", errors });
  }
  next();
};

module.exports = { validate, sendMessageSchema, conversationSchema };
