// MVP Heuristic AI Pricing Curve
// Simulates an AI pricing engine by using weighted factors for seasonality, demand, and guide expertise.
// Phase 3 will replace this with an external ML/LLM model.

const calculateDynamicPrice = (baseCost, season, guideTier, demandFactor) => {
  let cost = baseCost;
  
  // Seasonal Multiplier
  let seasonalMult = 1.0;
  const peakSeasons = ["Spring", "Autumn"];
  const shoulderSeasons = ["Winter", "Summer"];
  
  if (peakSeasons.includes(season)) seasonalMult = 1.15;
  else if (shoulderSeasons.includes(season)) seasonalMult = 0.90; // Discounts in off-season
  
  cost = cost * seasonalMult;
  
  // Demand Factor (0.0 to 1.0 where 1.0 is highest demand)
  // Increases price up to 20% during extreme high demand
  const demandMult = 1.0 + (demandFactor * 0.20);
  cost = cost * demandMult;
  
  // Guide Tier Multiplier
  let tierMult = 1.0;
  if (guideTier === "Expert") tierMult = 1.30;
  else if (guideTier === "Standard") tierMult = 1.0;
  
  cost = cost * tierMult;
  
  // AI Confidence Score Simulation
  // Mimics an ML model's confidence in the suggested price point based on training variance
  const confidenceScore = Math.floor(Math.random() * (98 - 85 + 1) + 85);
  
  return {
    recommendedPrice: Math.round(cost),
    factors: {
      seasonalMultiplier: seasonalMult,
      demandMultiplier: demandMult,
      tierMultiplier: tierMult
    },
    confidenceScore: `${confidenceScore}%`,
    suggestedMargin: Math.round(cost * 0.12) // Suggested platform take logic
  };
};

module.exports = {
  calculateDynamicPrice
};
