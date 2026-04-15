const mongoose = require("mongoose"); // Import Mongoose
const bcrypt = require("bcryptjs"); // Import bcryptjs for password hashing

// Define User schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // IMPORTANT: Exclude password field by default when querying
    },
    balance: {
      type: Number,
      default: 10000000, 
      min: 0,
    }, // ALWAYS STORED IN PAISE - DO NOT divide by 100 here
    reservedBalancePaise: {
      type: Number,
      default: 0,
      min: 0,
    }, // ALWAYS STORED IN PAISE - DO NOT divide by 100 here
    totalInvested: {
      type: Number,
      default: 0,
    }, // ALWAYS STORED IN PAISE - DO NOT divide by 100 here
    realizedPnL: {
      type: Number,
      default: 0,
    }, // ALWAYS STORED IN PAISE - DO NOT divide by 100 here
    refreshToken: {
      type: String,
      select: false,
    },
    dailySnapshots: [{
      date: { type: Date, default: Date.now },
      netEquity: { type: Number, required: true },
      balance: { type: Number, required: true },
      totalInvested: { type: Number, required: true },
    }],
    analyticsSnapshot: {
      skillScore: { type: Number, default: 50 },
      disciplineScore: { type: Number, default: 50 },
      trend: { type: String, default: "STABLE" },
      tags: { type: [String], default: [] },
      lastUpdated: { type: Date, default: Date.now }
    },

  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
//

const User = mongoose.model("User", userSchema);
module.exports = User;
