const getMe = (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
    },
  });
};

module.exports = {
  getMe,
};
