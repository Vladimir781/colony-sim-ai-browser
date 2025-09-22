const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'settlement_first',
    stat: 'structuresBuilt',
    target: 1,
    title: 'Первое укрытие',
    description: 'Постройте своё первое укрытие и дайте колонии ощущение дома.',
    points: 50,
  },
  {
    id: 'resource_harvest',
    stat: 'resourcesGathered',
    target: 60,
    title: 'Ресурсный рывок',
    description: 'Соберите 60 единиц ресурсов для дальнейшего развития базы.',
    points: 80,
  },
  {
    id: 'defense_line',
    stat: 'predatorDefenses',
    target: 5,
    title: 'Линия обороны',
    description: 'Отразите 5 атак хищников, защищая жителей колонии.',
    points: 90,
  },
  {
    id: 'comm_network',
    stat: 'messagesSent',
    target: 15,
    title: 'Голос колонии',
    description: 'Отправьте 15 радиосообщений, чтобы колонисты работали слаженно.',
    points: 70,
  },
  {
    id: 'exploration_master',
    stat: 'tilesExplored',
    target: 120,
    title: 'Картографы',
    description: 'Исследуйте 120 уникальных тайлов и составьте карту окрестностей.',
    points: 100,
  },
  {
    id: 'wellfed',
    type: 'streak',
    streak: 'highSatiety',
    target: 120,
    title: 'Накормленные сердца',
    description: 'Держите среднюю сытость выше 0.75 в течение 120 тиков подряд.',
    points: 110,
  },
  {
    id: 'unbroken',
    stat: 'survivalTicks',
    target: 300,
    title: 'Несокрушимые',
    description: 'Поддерживайте колонию без критического голода и усталости 300 тиков.',
    points: 130,
  },
  {
    id: 'master_builder',
    stat: 'structuresBuilt',
    target: 8,
    title: 'Город мастеров',
    description: 'Возведите 8 укрытий и превратите поселение в город.',
    points: 140,
  },
];

const CHALLENGE_TEMPLATES = [
  {
    id: 'challenge_resources',
    stat: 'resourcesGathered',
    baseTarget: 45,
    scale: 0.12,
    rewardPoints: 90,
    title: 'Ресурсный марафон',
    description: (target) => `Соберите ${target} ресурсов до конца дня.`,
  },
  {
    id: 'challenge_structures',
    stat: 'structuresImproved',
    baseTarget: 4,
    scale: 0.18,
    rewardPoints: 110,
    title: 'Архитектор дня',
    description: (target) => `Постройте или укрепите ${target} укрытий.`,
  },
  {
    id: 'challenge_comms',
    stat: 'messagesSent',
    baseTarget: 12,
    scale: 0.15,
    rewardPoints: 70,
    title: 'На связи',
    description: (target) => `Отправьте ${target} сообщений, чтобы агенты действовали слаженно.`,
  },
  {
    id: 'challenge_explore',
    stat: 'tilesExplored',
    baseTarget: 80,
    scale: 0.08,
    rewardPoints: 120,
    title: 'Картограф',
    description: (target) => `Откройте ${target} новых тайлов и отметьте их на карте.`,
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class ProgressionTracker {
  constructor({ tickRate = 12, challengeDurationTicks } = {}) {
    this.tickRate = tickRate;
    this.challengeDuration = challengeDurationTicks ?? tickRate * 180;
    this.stats = {
      resourcesGathered: 0,
      foodGathered: 0,
      woodGathered: 0,
      structuresBuilt: 0,
      structuresReinforced: 0,
      structuresImproved: 0,
      predatorDefenses: 0,
      predatorEncounters: 0,
      messagesSent: 0,
      tilesExplored: 0,
      survivalTicks: 0,
      restTicks: 0,
      cumulativeReward: 0,
      positiveReward: 0,
      achievementPoints: 0,
      dailyChallengePoints: 0,
      agentCount: 0,
      structureCount: 0,
      predatorCount: 0,
      herbivoreCount: 0,
      bestSatietyStreak: 0,
      bestEnergyStreak: 0,
    };
    this.streaks = {
      highSatiety: 0,
      highEnergy: 0,
    };
    this.visitedTiles = new Set();
    this.achievements = ACHIEVEMENT_DEFINITIONS.map((definition) => ({
      ...definition,
      unlocked: false,
      unlockedAt: null,
      progress: 0,
    }));
    this.notifications = [];
    this.notificationHistory = [];
    this.notificationCounter = 1;
    this.level = 1;
    this.score = 0;
    this.effectiveScore = 0;
    this.multiplier = 1;
    this.mood = 0;
    this.ticks = 0;
    this.challengeCounter = 0;
    this.dailyChallenge = null;
    this.generateInitialChallenge();
  }

  generateInitialChallenge() {
    this.dailyChallenge = this.generateDailyChallenge();
  }

  generateDailyChallenge() {
    if (!CHALLENGE_TEMPLATES.length) return null;
    const template = CHALLENGE_TEMPLATES[this.challengeCounter % CHALLENGE_TEMPLATES.length];
    this.challengeCounter += 1;
    const baseline = this.stats[template.stat] ?? 0;
    const scaled = template.baseTarget + Math.round(baseline * template.scale);
    const target = Math.max(template.baseTarget, scaled - baseline > 0 ? scaled - baseline : scaled);
    return {
      id: `${template.id}-${this.challengeCounter}`,
      templateId: template.id,
      title: template.title,
      description: template.description(target),
      stat: template.stat,
      baseline,
      target,
      progress: 0,
      rewardPoints: template.rewardPoints,
      startTick: this.ticks,
      expiresAtTick: this.ticks + this.challengeDuration,
      completed: false,
      completedAt: null,
    };
  }

  emitNotification({ type, title, message, points = 0, tick = this.ticks, extra }) {
    const id = `note-${this.notificationCounter.toString(16)}`;
    this.notificationCounter += 1;
    const entry = {
      id,
      type,
      title: title ?? '',
      message,
      points,
      tick,
      ...extra,
    };
    this.notifications.push(entry);
    this.notificationHistory.push(entry);
    if (this.notificationHistory.length > 30) {
      this.notificationHistory.shift();
    }
  }

  recordResource(kind, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.stats.resourcesGathered += amount;
    if (kind === 'food') {
      this.stats.foodGathered += amount;
    } else if (kind === 'wood') {
      this.stats.woodGathered += amount;
    }
    this.checkAchievements();
  }

  recordStructureBuilt() {
    this.stats.structuresBuilt += 1;
    this.stats.structuresImproved += 1;
    this.checkAchievements();
  }

  recordStructureReinforced() {
    this.stats.structuresReinforced += 1;
    this.stats.structuresImproved += 1;
    this.checkAchievements();
  }

  recordPredatorDefense() {
    this.stats.predatorDefenses += 1;
    this.checkAchievements();
  }

  recordPredatorEncounter({ survived }) {
    this.stats.predatorEncounters += 1;
    if (survived) {
      this.stats.survivalTicks += 1;
    }
    this.checkAchievements();
  }

  recordMessageSent() {
    this.stats.messagesSent += 1;
    this.checkAchievements();
  }

  recordRestTick() {
    this.stats.restTicks += 1;
  }

  recordExploreAction() {
    // the unique tile tracking happens separately, but keeping a hook for future use
  }

  recordReward(value) {
    if (!Number.isFinite(value)) return;
    this.stats.cumulativeReward += value;
    if (value > 0) this.stats.positiveReward += value;
  }

  noteTileVisit(x, y) {
    const key = `${x}|${y}`;
    if (this.visitedTiles.has(key)) return;
    this.visitedTiles.add(key);
    this.stats.tilesExplored = this.visitedTiles.size;
    this.checkAchievements();
  }

  checkAchievements() {
    for (const achievement of this.achievements) {
      if (achievement.type === 'streak') {
        const streakValue = this.streaks[achievement.streak] ?? 0;
        achievement.progress = Math.min(streakValue, achievement.target);
        if (!achievement.unlocked && streakValue >= achievement.target) {
          this.unlockAchievement(achievement);
        }
        continue;
      }
      const value = this.stats[achievement.stat] ?? 0;
      achievement.progress = Math.min(value, achievement.target);
      if (!achievement.unlocked && value >= achievement.target) {
        this.unlockAchievement(achievement);
      }
    }
  }

  unlockAchievement(achievement) {
    achievement.unlocked = true;
    achievement.unlockedAt = this.ticks;
    this.stats.achievementPoints += achievement.points;
    this.emitNotification({
      type: 'achievement',
      title: 'Новое достижение',
      message: `«${achievement.title}» +${achievement.points} очков`,
      points: achievement.points,
    });
  }

  updateDailyChallenge() {
    if (!this.dailyChallenge) {
      this.dailyChallenge = this.generateDailyChallenge();
      return;
    }
    const challenge = this.dailyChallenge;
    const current = this.stats[challenge.stat] ?? 0;
    challenge.progress = Math.max(0, current - challenge.baseline);
    if (!challenge.completed && challenge.target > 0 && challenge.progress >= challenge.target) {
      challenge.completed = true;
      challenge.completedAt = this.ticks;
      this.stats.dailyChallengePoints += challenge.rewardPoints;
      this.emitNotification({
        type: 'challenge',
        title: 'Челлендж выполнен',
        message: `«${challenge.title}» +${challenge.rewardPoints} очков`,
        points: challenge.rewardPoints,
      });
      challenge.expiresAtTick = Math.min(challenge.expiresAtTick, this.ticks + this.tickRate * 60);
    }
    if (this.ticks >= challenge.expiresAtTick) {
      if (!challenge.completed) {
        this.emitNotification({
          type: 'challenge',
          title: 'Челлендж провален',
          message: `«${challenge.title}» истёк без выполнения`,
        });
      }
      this.dailyChallenge = this.generateDailyChallenge();
    }
  }

  recalculateScore(metrics = {}) {
    const baseScore =
      this.stats.resourcesGathered * 2 +
      this.stats.structuresBuilt * 35 +
      this.stats.structuresReinforced * 10 +
      this.stats.predatorDefenses * 25 +
      this.stats.messagesSent * 4 +
      this.stats.tilesExplored * 1.5 +
      this.stats.survivalTicks * 1.2 +
      this.stats.restTicks * 0.5 +
      this.stats.achievementPoints +
      this.stats.dailyChallengePoints;
    const moraleBonus = ((metrics.avgSatiety ?? 0) + (metrics.avgEnergy ?? 0)) * 18;
    const streakBonus = this.streaks.highSatiety * 0.4 + this.streaks.highEnergy * 0.25;
    this.score = Math.round(baseScore + moraleBonus + streakBonus);
    const unlocked = this.achievements.filter((item) => item.unlocked).length;
    const survivalFactor = clamp(this.stats.survivalTicks / 600, 0, 0.35);
    this.multiplier = Number((1 + unlocked * 0.04 + survivalFactor).toFixed(2));
    this.effectiveScore = Math.max(0, Math.round(this.score * this.multiplier));
    this.level = Math.max(1, Math.floor(this.effectiveScore / 160) + 1);
    this.mood = Number(
      clamp(((metrics.avgSatiety ?? 0) + (metrics.avgEnergy ?? 0)) / 2, 0, 1).toFixed(2),
    );
    this.unlockedCount = unlocked;
  }

  updateTick({ tick, metrics, agents, structures = 0, predators = 0, herbivores = 0 }) {
    this.ticks = tick;
    this.stats.agentCount = agents.length;
    this.stats.structureCount = structures;
    this.stats.predatorCount = predators;
    this.stats.herbivoreCount = herbivores;

    const safeAgents = agents.every((agent) => agent.energy > 0.2 && agent.satiety > 0.2);
    if (safeAgents && agents.length > 0) {
      this.stats.survivalTicks += 1;
    }

    if ((metrics?.avgSatiety ?? 0) >= 0.75) {
      this.streaks.highSatiety += 1;
    } else {
      this.streaks.highSatiety = 0;
    }
    if ((metrics?.avgEnergy ?? 0) >= 0.65) {
      this.streaks.highEnergy += 1;
    } else {
      this.streaks.highEnergy = 0;
    }
    this.stats.bestSatietyStreak = Math.max(this.stats.bestSatietyStreak, this.streaks.highSatiety);
    this.stats.bestEnergyStreak = Math.max(this.stats.bestEnergyStreak, this.streaks.highEnergy);

    this.checkAchievements();
    this.updateDailyChallenge();
    this.recalculateScore(metrics ?? {});
  }

  load(data) {
    if (!data || typeof data !== 'object') return;
    this.stats = { ...this.stats, ...(data.stats ?? {}) };
    this.level = data.level ?? this.level;
    this.score = data.score ?? this.score;
    this.effectiveScore = data.effectiveScore ?? this.effectiveScore;
    this.multiplier = data.multiplier ?? this.multiplier;
    this.mood = data.mood ?? this.mood;
    this.unlockedCount = data.unlockedCount ?? this.unlockedCount ?? 0;
    if (Array.isArray(data.achievements)) {
      const stored = new Map(data.achievements.map((item) => [item.id, item]));
      this.achievements = this.achievements.map((achievement) => {
        const snapshotAchievement = stored.get(achievement.id);
        if (!snapshotAchievement) return achievement;
        return {
          ...achievement,
          unlocked: snapshotAchievement.unlocked ?? achievement.unlocked,
          unlockedAt: snapshotAchievement.unlockedAt ?? achievement.unlockedAt,
          progress: snapshotAchievement.progress ?? achievement.progress,
        };
      });
    }
    if (Array.isArray(data.history)) {
      this.notificationHistory = data.history.map((entry) => ({ ...entry }));
      this.notifications = [];
    }
    this.dailyChallenge = this.generateDailyChallenge();
    this.checkAchievements();
    this.recalculateScore();
  }

  snapshot() {
    return {
      level: this.level,
      score: this.score,
      effectiveScore: this.effectiveScore,
      multiplier: this.multiplier,
      mood: this.mood,
      unlockedCount: this.unlockedCount ?? 0,
      stats: { ...this.stats },
      achievements: this.achievements.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        target: achievement.target,
        progress: achievement.progress,
        points: achievement.points,
        unlocked: achievement.unlocked,
        unlockedAt: achievement.unlockedAt,
        type: achievement.type ?? 'stat',
      })),
      dailyChallenge: this.dailyChallenge
        ? {
            ...this.dailyChallenge,
            progress: Math.min(this.dailyChallenge.progress, this.dailyChallenge.target),
            remainingTicks: Math.max(0, this.dailyChallenge.expiresAtTick - this.ticks),
            remainingSeconds: Math.max(
              0,
              Math.ceil(Math.max(0, this.dailyChallenge.expiresAtTick - this.ticks) / this.tickRate),
            ),
          }
        : null,
      history: this.notificationHistory.map((entry) => ({ ...entry })),
      notifications: this.notifications.splice(0),
    };
  }
}
