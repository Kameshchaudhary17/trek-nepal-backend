const { Pricing, GuideRateProposal } = require('../models/Pricing');
const aiPricingService = require('../services/aiPricingService');

exports.getPricingConfig = async (req, res) => {
  try {
    const config = await Pricing.find({});
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pricing config" });
  }
};

exports.updatePricingConfig = async (req, res) => {
  try {
    const { trekId, baseCost, permitCost, platformFeePct } = req.body;
    let config = await Pricing.findOne({ trekId });
    if (!config) {
      config = new Pricing(req.body);
    } else {
      config.baseCost = baseCost;
      config.permitCost = permitCost;
      config.platformFeePct = platformFeePct;
    }
    await config.save();
    res.status(200).json({ message: "Pricing updated", config });
  } catch (error) {
    res.status(500).json({ message: "Failed to update pricing" });
  }
};

exports.getAIRecommendation = async (req, res) => {
  try {
    const { baseCost, season, guideTier, demandFactor } = req.query;
    
    // Default mock inputs if not provided to simulate the AI engine testing
    const cost = parseFloat(baseCost) || 800; // Typical EBC cost
    const tier = guideTier || 'Standard';
    const s = season || 'Autumn';
    const demand = parseFloat(demandFactor) || 0.85; // High demand factor
    
    const recommendation = aiPricingService.calculateDynamicPrice(cost, s, tier, demand);
    res.status(200).json(recommendation);
  } catch (error) {
    res.status(500).json({ message: "AI recommendation calculation failed" });
  }
};
