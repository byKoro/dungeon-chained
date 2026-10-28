export const TINY_RPG_ENEMIES = [
    {
        "key": "blackKnightA",
        "label": "Cavaleiro Negro A",
        "src": "assets/enemies/black_knight_a.png",
        "cellSize": 100,
        "cropX": 5,
        "cropY": 1,
        "cropW": 95,
        "cropH": 70,
        "body": {
            "x": 43,
            "y": 27,
            "w": 17,
            "h": 32
        },
        "drawHeight": 220,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 16,
                "fps": 3,
                "hitFrame": 12
            },
            "attack2": {
                "row": 3,
                "frames": 15,
                "fps": 3,
                "hitFrame": 11
            },
            "attack3": {
                "row": 4,
                "frames": 15,
                "fps": 3,
                "hitFrame": 11
            },
            "death": {
                "row": 5,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 3,
            "gridRows": 2,
            "box": {
                "x": 42,
                "y": 48,
                "w": 14,
                "h": 9
            }
        }
    },
    {
        "key": "blackKnightB",
        "label": "Cavaleiro Negro B",
        "src": "assets/enemies/black_knight_b.png",
        "cellSize": 100,
        "cropX": 31,
        "cropY": 26,
        "cropW": 56,
        "cropH": 34,
        "body": {
            "x": 41,
            "y": 36,
            "w": 19,
            "h": 22
        },
        "drawHeight": 107,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 7,
                "fps": 5,
                "hitFrame": 5
            },
            "attack2": {
                "row": 3,
                "frames": 8,
                "fps": 5,
                "hitFrame": 5
            },
            "attack3": {
                "row": 4,
                "frames": 9,
                "fps": 5,
                "hitFrame": 7
            },
            "death": {
                "row": 5,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 3,
            "gridRows": 2,
            "box": {
                "x": 43,
                "y": 48,
                "w": 17,
                "h": 9
            }
        }
    },
    {
        "key": "blackKnightC",
        "label": "Cavaleiro Negro C",
        "src": "assets/enemies/black_knight_c.png",
        "cellSize": 100,
        "cropX": 27,
        "cropY": 0,
        "cropW": 67,
        "cropH": 74,
        "body": {
            "x": 36,
            "y": 29,
            "w": 39,
            "h": 28
        },
        "drawHeight": 233,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 8,
                "fps": 5,
                "hitFrame": 6
            },
            "attack2": {
                "row": 3,
                "frames": 9,
                "fps": 5,
                "hitFrame": 5
            },
            "attack3": {
                "row": 4,
                "frames": 13,
                "fps": 4,
                "hitFrame": 5
            },
            "death": {
                "row": 5,
                "frames": 7,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 4,
            "gridRows": 4,
            "box": {
                "x": 43,
                "y": 12,
                "w": 18,
                "h": 48
            }
        }
    },
    {
        "key": "bloodMonsterB",
        "label": "Monstro de Sangue B (Voador)",
        "src": "assets/enemies/blood_monster_b.png",
        "cellSize": 100,
        "cropX": 39,
        "cropY": 27,
        "cropW": 45,
        "cropH": 35,
        "body": {
            "x": 46,
            "y": 39,
            "w": 14,
            "h": 16
        },
        "drawHeight": 110,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 6,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 8,
                "fps": 5,
                "hitFrame": 3
            },
            "attack2": {
                "row": 3,
                "frames": 9,
                "fps": 5,
                "hitFrame": 6
            },
            "death": {
                "row": 4,
                "frames": 5,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 3,
            "gridRows": 4,
            "box": {
                "x": 39,
                "y": 27,
                "w": 10,
                "h": 27
            }
        }
    },
    {
        "key": "demonessA",
        "label": "Demônia A",
        "src": "assets/enemies/demoness_a.png",
        "cellSize": 100,
        "cropX": 21,
        "cropY": 23,
        "cropW": 79,
        "cropH": 49,
        "body": {
            "x": 38,
            "y": 31,
            "w": 34,
            "h": 28
        },
        "drawHeight": 154,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 9,
                "fps": 5,
                "hitFrame": 5
            },
            "attack2": {
                "row": 3,
                "frames": 15,
                "fps": 3,
                "hitFrame": 13
            },
            "attack3": {
                "row": 4,
                "frames": 16,
                "fps": 3,
                "hitFrame": 8
            },
            "death": {
                "row": 5,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 4,
            "box": {
                "x": 46,
                "y": 42,
                "w": 48,
                "h": 19
            }
        }
    },
    {
        "key": "demonessB",
        "label": "Demônia B",
        "src": "assets/enemies/demoness_b.png",
        "cellSize": 100,
        "cropX": 26,
        "cropY": 20,
        "cropW": 64,
        "cropH": 58,
        "body": {
            "x": 37,
            "y": 34,
            "w": 24,
            "h": 25
        },
        "drawHeight": 183,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 6,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 8,
                "fps": 5,
                "hitFrame": 5
            },
            "attack2": {
                "row": 3,
                "frames": 8,
                "fps": 5,
                "hitFrame": 4
            },
            "death": {
                "row": 4,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 3,
            "box": {
                "x": 44,
                "y": 46,
                "w": 24,
                "h": 11
            }
        }
    },
    {
        "key": "demonB",
        "label": "Demônio B",
        "src": "assets/enemies/demon_b.png",
        "cellSize": 100,
        "cropX": 31,
        "cropY": 34,
        "cropW": 46,
        "cropH": 28,
        "body": {
            "x": 43,
            "y": 39,
            "w": 18,
            "h": 20
        },
        "drawHeight": 88,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 9,
                "fps": 5,
                "hitFrame": 6
            },
            "attack2": {
                "row": 3,
                "frames": 6,
                "fps": 5,
                "hitFrame": 3
            },
            "death": {
                "row": 4,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 4,
            "gridRows": 3,
            "box": {
                "x": 31,
                "y": 45,
                "w": 18,
                "h": 12
            }
        }
    },
    {
        "key": "demonC",
        "label": "Demônio C",
        "src": "assets/enemies/demon_c.png",
        "cellSize": 100,
        "cropX": 30,
        "cropY": 26,
        "cropW": 58,
        "cropH": 35,
        "body": {
            "x": 38,
            "y": 32,
            "w": 32,
            "h": 24
        },
        "drawHeight": 110,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 6,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 6,
                "fps": 5,
                "hitFrame": 4
            },
            "attack2": {
                "row": 3,
                "frames": 6,
                "fps": 5,
                "hitFrame": 3
            },
            "death": {
                "row": 4,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 4,
            "gridRows": 3,
            "box": {
                "x": 30,
                "y": 47,
                "w": 19,
                "h": 13
            }
        }
    },
    {
        "key": "demonD",
        "label": "Demônio D",
        "src": "assets/enemies/demon_d.png",
        "cellSize": 100,
        "cropX": 12,
        "cropY": 12,
        "cropW": 77,
        "cropH": 62,
        "body": {
            "x": 43,
            "y": 33,
            "w": 25,
            "h": 26
        },
        "drawHeight": 195,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 11,
                "fps": 4,
                "hitFrame": 9
            },
            "attack2": {
                "row": 3,
                "frames": 18,
                "fps": 3,
                "hitFrame": 16
            },
            "attack3": {
                "row": 4,
                "frames": 12,
                "fps": 4,
                "hitFrame": 9
            },
            "death": {
                "row": 5,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 3,
            "box": {
                "x": 44,
                "y": 46,
                "w": 41,
                "h": 13
            }
        }
    },
    {
        "key": "demonE",
        "label": "Demônio E",
        "src": "assets/enemies/demon_e.png",
        "cellSize": 100,
        "cropX": 26,
        "cropY": 20,
        "cropW": 63,
        "cropH": 47,
        "body": {
            "x": 32,
            "y": 35,
            "w": 46,
            "h": 25
        },
        "drawHeight": 148,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 8,
                "fps": 5,
                "hitFrame": 6
            },
            "attack2": {
                "row": 3,
                "frames": 13,
                "fps": 4,
                "hitFrame": 7
            },
            "attack3": {
                "row": 4,
                "frames": 8,
                "fps": 5,
                "hitFrame": 5
            },
            "death": {
                "row": 5,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 3,
            "box": {
                "x": 40,
                "y": 44,
                "w": 26,
                "h": 13
            }
        }
    },
    {
        "key": "eyeballMonster",
        "label": "Monstro Olho",
        "src": "assets/enemies/eyeball_monster.png",
        "cellSize": 100,
        "cropX": 41,
        "cropY": 31,
        "cropW": 59,
        "cropH": 30,
        "body": {
            "x": 42,
            "y": 43,
            "w": 17,
            "h": 15
        },
        "drawHeight": 94,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 6,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 8,
                "fps": 5,
                "hitFrame": 6
            },
            "attack2": {
                "row": 3,
                "frames": 8,
                "fps": 5,
                "hitFrame": 6
            },
            "attack3": {
                "row": 4,
                "frames": 6,
                "fps": 5,
                "hitFrame": 2
            },
            "death": {
                "row": 5,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 4,
            "gridRows": 2,
            "box": {
                "x": 42,
                "y": 50,
                "w": 22,
                "h": 8
            }
        }
    },
    {
        "key": "flameGolem",
        "label": "Golem de Chamas",
        "src": "assets/enemies/flame_golem.png",
        "cellSize": 100,
        "cropX": 30,
        "cropY": 20,
        "cropW": 59,
        "cropH": 39,
        "body": {
            "x": 36,
            "y": 29,
            "w": 32,
            "h": 28
        },
        "drawHeight": 123,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 12,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 9,
                "fps": 5,
                "hitFrame": 6
            },
            "attack2": {
                "row": 3,
                "frames": 9,
                "fps": 5,
                "hitFrame": 6
            },
            "attack3": {
                "row": 4,
                "frames": 9,
                "fps": 5,
                "hitFrame": 6
            },
            "death": {
                "row": 5,
                "frames": 6,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 4,
            "box": {
                "x": 36,
                "y": 41,
                "w": 37,
                "h": 18
            }
        }
    },
    {
        "key": "ghostfire",
        "label": "Ghostfire (Boss do trailer)",
        "src": "assets/enemies/ghostfire.png",
        "cellSize": 100,
        "cropX": 33,
        "cropY": 21,
        "cropW": 67,
        "cropH": 36,
        "body": {
            "x": 46,
            "y": 26,
            "w": 13,
            "h": 27
        },
        "drawHeight": 113,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 6,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 6,
                "fps": 5,
                "hitFrame": 3
            },
            "attack2": {
                "row": 3,
                "frames": 7,
                "fps": 5,
                "hitFrame": 3
            },
            "death": {
                "row": 4,
                "frames": 6,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 3,
            "gridRows": 3,
            "box": {
                "x": 43,
                "y": 46,
                "w": 10,
                "h": 11
            }
        }
    },
    {
        "key": "hellbat",
        "label": "Morcego Infernal (Voador)",
        "src": "assets/enemies/hellbat.png",
        "cellSize": 100,
        "cropX": 20,
        "cropY": 32,
        "cropW": 70,
        "cropH": 31,
        "body": {
            "x": 36,
            "y": 32,
            "w": 26,
            "h": 23
        },
        "drawHeight": 98,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 6,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 6,
                "fps": 5,
                "hitFrame": 4
            },
            "attack2": {
                "row": 3,
                "frames": 7,
                "fps": 5,
                "hitFrame": 4
            },
            "death": {
                "row": 4,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 3,
            "box": {
                "x": 32,
                "y": 49,
                "w": 25,
                "h": 12
            }
        }
    },
    {
        "key": "hellhound",
        "label": "Cão Infernal",
        "src": "assets/enemies/hellhound.png",
        "cellSize": 100,
        "cropX": 31,
        "cropY": 33,
        "cropW": 69,
        "cropH": 31,
        "body": {
            "x": 36,
            "y": 40,
            "w": 29,
            "h": 17
        },
        "drawHeight": 98,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 8,
                "fps": 5,
                "hitFrame": 5
            },
            "attack2": {
                "row": 3,
                "frames": 8,
                "fps": 5,
                "hitFrame": 5
            },
            "death": {
                "row": 4,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 3,
            "box": {
                "x": 36,
                "y": 46,
                "w": 30,
                "h": 11
            }
        }
    },
    {
        "key": "lavaSlime",
        "label": "Slime de Lava",
        "src": "assets/enemies/lava_slime.png",
        "cellSize": 100,
        "cropX": 35,
        "cropY": 36,
        "cropW": 49,
        "cropH": 22,
        "body": {
            "x": 35,
            "y": 41,
            "w": 28,
            "h": 16
        },
        "drawHeight": 69,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 6,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 6,
                "fps": 5,
                "hitFrame": 3
            },
            "attack2": {
                "row": 3,
                "frames": 9,
                "fps": 5,
                "hitFrame": 4
            },
            "death": {
                "row": 4,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 2,
            "box": {
                "x": 36,
                "y": 49,
                "w": 26,
                "h": 9
            }
        }
    },
    {
        "key": "minotaur",
        "label": "Minotauro",
        "src": "assets/enemies/minotaur.png",
        "cellSize": 100,
        "cropX": 39,
        "cropY": 20,
        "cropW": 55,
        "cropH": 48,
        "body": {
            "x": 41,
            "y": 37,
            "w": 30,
            "h": 22
        },
        "drawHeight": 151,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 8,
                "fps": 5,
                "hitFrame": 6
            },
            "attack2": {
                "row": 3,
                "frames": 7,
                "fps": 5,
                "hitFrame": 5
            },
            "attack3": {
                "row": 4,
                "frames": 7,
                "fps": 5,
                "hitFrame": 5
            },
            "death": {
                "row": 5,
                "frames": 4,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 5,
            "gridRows": 4,
            "box": {
                "x": 44,
                "y": 47,
                "w": 28,
                "h": 16
            }
        }
    },
    {
        "key": "warlock",
        "label": "Bruxo",
        "src": "assets/enemies/warlock.png",
        "cellSize": 100,
        "cropX": 40,
        "cropY": 21,
        "cropW": 33,
        "cropH": 43,
        "body": {
            "x": 40,
            "y": 33,
            "w": 21,
            "h": 26
        },
        "drawHeight": 135,
        "rows": {
            "walk": {
                "row": 1,
                "frames": 8,
                "fps": 6
            },
            "attack": {
                "row": 2,
                "frames": 7,
                "fps": 5,
                "hitFrame": 4
            },
            "attack2": {
                "row": 3,
                "frames": 6,
                "fps": 5,
                "hitFrame": 4
            },
            "death": {
                "row": 4,
                "frames": 9,
                "fps": 7
            }
        },
        "deathFlash": {
            "row": 0,
            "frame": 0
        },
        "gib": {
            "gridCols": 3,
            "gridRows": 4,
            "box": {
                "x": 46,
                "y": 32,
                "w": 7,
                "h": 32
            }
        }
    }
];
