const healthCheck = (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Backend is healthy",
  });
};

module.exports = {
  healthCheck,
};
