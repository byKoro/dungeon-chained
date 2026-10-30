import { GHOSTFIRE } from '../config/GhostfireConfig.js';

export class GhostfireRenderer {
    drawBody(ctx, boss) {
        const img = boss.sheet;
        if (boss.isHidden || !img?.complete || !img.naturalWidth) return;
        const s = GHOSTFIRE.sprite;
        const { row, frame } = boss.visualFrame;
        const extended = row === 3 && frame >= 3 && frame <= 5;
        const anchorX = extended ? s.beamAnchorX : s.anchorX;
        const width = extended ? s.beamHotStart : s.cell;
        const direction = boss.side === "left" ? 1 : -1;
        const vanish = boss.state === "teleport" ? 1 - boss.stateTimer / GHOSTFIRE.teleportFrames : 0;
        const arrival = boss.state === "appear" && !boss.frozen ? boss.stateTimer / GHOSTFIRE.appearFrames : 0;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha *= (1 - vanish) * (1 - arrival);
        if (boss.hitCooldown > 0 && Math.floor(boss.hitCooldown / GHOSTFIRE.hitBlinkFrames) % 2) ctx.globalAlpha *= GHOSTFIRE.hitAlpha;
        if (boss.frozen && boss.spawnFx > 0) ctx.globalAlpha *= 1 - boss.spawnFx / boss.spawnFxDuration;
        const x = boss.x - direction * s.arrivalOffset * arrival * arrival;
        const y = boss.y + boss.hoverOffset;
        this._drawGlow(ctx, x, y - s.scale * s.glowCenterOffset, s.glowRadius);
        ctx.translate(Math.round(x), Math.round(y));
        ctx.scale(direction * s.scale, s.scale * (1 + vanish * s.teleportStretch));
        ctx.drawImage(img, frame * s.cell, row * s.cell, width, s.cell, -anchorX, -s.anchorY, width, s.cell);
        ctx.restore();
    }

    drawBeam(ctx, boss) {
        const img = boss.sheet, beam = boss.beam;
        if (!beam || boss.isHidden || boss.frozen || !img?.complete || !img.naturalWidth) return;
        const s = GHOSTFIRE.sprite;
        const { row, frame } = boss.visualFrame;
        const totalLength = Math.abs(beam.endX - beam.x);
        const launchWidth = (s.beamHotStart - s.beamAnchorX - s.mouthOffset) * s.scale;
        const length = Math.max(0, totalLength - launchWidth);
        const direction = beam.endX >= beam.x ? 1 : -1;
        const warning = boss.state === "indicator";
        const fading = boss.state === "fade";

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(beam.x), Math.round(beam.y));
        ctx.scale(direction, 1);
        this._drawBeamGlow(ctx, totalLength, boss);
        ctx.translate(launchWidth, 0);
        if (warning || fading) {
            ctx.globalAlpha *= warning ? s.warningBaseAlpha + s.warningPulseAlpha * Math.sin(boss.animTime) : boss.stateTimer / GHOSTFIRE.fadeFrames;
            ctx.drawImage(img, frame * s.cell + s.warningColumn, row * s.cell + s.warningRow, 1, s.warningHeight,
                0, (s.warningRow - s.beamRow - s.beamHeight / 2) * s.scale, length, s.warningHeight * s.scale);
        } else {
            const tileWidth = (s.beamHotEnd - s.beamHotStart) * s.scale;
            const tailWidth = Math.min(s.beamTail * s.scale, length);
            const end = length - tailWidth;
            const offset = Math.floor(boss.animTime / 60 * s.beamFlow) % (s.beamHotEnd - s.beamHotStart) * s.scale;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, -GHOSTFIRE.beamWidth / 2, end, GHOSTFIRE.beamWidth);
            ctx.clip();
            for (let x = -tileWidth + offset; x < end; x += tileWidth) {
                ctx.drawImage(img, frame * s.cell + s.beamHotStart, row * s.cell + s.beamRow,
                    s.beamHotEnd - s.beamHotStart, s.beamHeight,
                    x, -GHOSTFIRE.beamWidth / 2, tileWidth, GHOSTFIRE.beamWidth);
            }
            ctx.restore();
            ctx.drawImage(img, frame * s.cell + s.beamHotEnd, row * s.cell + s.beamRow,
                s.beamTail, s.beamHeight, end, -GHOSTFIRE.beamWidth / 2, tailWidth, GHOSTFIRE.beamWidth);
        }
        ctx.restore();
    }

    drawSummon(ctx, shot) {
        const s = GHOSTFIRE.summon;
        const pixel = s.pixel;
        const x = Math.round(shot.x / pixel) * pixel;
        const y = Math.round(shot.y / pixel) * pixel;
        const pulse = Math.sin(shot.age * s.pulseSpeed) * pixel;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        this._drawGlow(ctx, x, y, s.glowRadius);
        ctx.translate(x, y);
        ctx.scale(shot.direction, 1);
        ctx.fillStyle = s.colors[0];
        ctx.fillRect(-s.radius - s.tailLength, -s.tailWidth / 2, s.tailLength, s.tailWidth);
        ctx.fillStyle = s.colors[1];
        ctx.fillRect(-s.radius - s.tailLength / 2, -pixel, s.tailLength, pixel * 2);
        for (let row = -s.radius; row < s.radius; row += pixel) {
            for (let col = -s.radius; col < s.radius; col += pixel) {
                const distance = Math.hypot(col + pixel / 2, row + pixel / 2);
                if (distance > s.radius) continue;
                const heat = Math.max(0, Math.min(s.colors.length - 1,
                    Math.floor((1 - distance / (s.radius + pulse)) * s.colors.length)));
                ctx.fillStyle = s.colors[heat];
                ctx.fillRect(col, row, pixel, pixel);
            }
        }
        ctx.restore();
    }

    _drawGlow(ctx, x, y, radius) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(${GHOSTFIRE.sprite.glowColor}, ${GHOSTFIRE.sprite.glowCoreAlpha})`);
        gradient.addColorStop(GHOSTFIRE.sprite.glowMidpoint, `rgba(${GHOSTFIRE.sprite.glowColor}, ${GHOSTFIRE.sprite.glowEdgeAlpha})`);
        gradient.addColorStop(1, `rgba(${GHOSTFIRE.sprite.glowColor}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    _drawBeamGlow(ctx, length, boss) {
        const s = GHOSTFIRE.sprite;
        const height = (boss.state === "indicator" ? s.warningGlowScale : s.beamGlowScale) * s.scale;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha *= s.beamGlowAlpha;
        if (boss.state === "fade") ctx.globalAlpha *= boss.stateTimer / GHOSTFIRE.fadeFrames;
        const glow = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
        glow.addColorStop(0, `rgba(${s.glowColor}, 0)`);
        glow.addColorStop(s.glowMidpoint, `rgba(${s.glowColor}, 1)`);
        glow.addColorStop(1, `rgba(${s.glowColor}, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, -height / 2, length, height);
        ctx.restore();
    }
}
