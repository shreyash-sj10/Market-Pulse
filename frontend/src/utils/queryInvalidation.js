export const invalidateSystemQueries = async (queryClient) => {
  const keys = [
    ["portfolio"],
    ["positions"],
    ["journal"],
    ["profile"],
    ["trades"],
    ["intelligence"],
    ["trace"]
  ];

  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
};

export const invalidateTradeLifecycleQueries = async (queryClient, options = {}) => {
  const { scheduleFollowUps = true } = options;
  await invalidateSystemQueries(queryClient);

  if (!scheduleFollowUps) {
    return () => {};
  }

  // Reflection and profile pipelines can complete a few seconds after execution.
  const followUpTimers = [3500, 9000, 18000].map((delayMs) =>
    setTimeout(() => {
      void invalidateSystemQueries(queryClient);
    }, delayMs),
  );

  return () => {
    followUpTimers.forEach((timerId) => clearTimeout(timerId));
  };
};
