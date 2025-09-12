// models/RefreshToken.js
const { Schema, model } = require('mongoose');

const RefreshTokenSchema = new Schema({
    token: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    expiryDate: { type: Date, required: true }
});

RefreshTokenSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 });

module.exports = model('RefreshToken', RefreshTokenSchema);