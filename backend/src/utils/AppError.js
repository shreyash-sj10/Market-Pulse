class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    if (code) this.code = code;
  }
}

module.exports = AppError;
