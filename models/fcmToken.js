const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema({
    extension: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    FCMRegistrationToken: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
fcmTokenSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Find and update or create method
fcmTokenSchema.statics.upsertToken = async function(extension, FCMRegistrationToken) {
    return this.findOneAndUpdate(
        { extension: extension },
        { 
            extension: extension,
            FCMRegistrationToken: FCMRegistrationToken,
            updatedAt: Date.now()
        },
        { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
        }
    );
};

// Find token by extension
fcmTokenSchema.statics.findByExtension = async function(extension) {
    const result = await this.findOne({ extension: extension });
    return result ? result.FCMRegistrationToken : null;
};

const FcmToken = mongoose.model('FcmToken', fcmTokenSchema);

module.exports = FcmToken;

