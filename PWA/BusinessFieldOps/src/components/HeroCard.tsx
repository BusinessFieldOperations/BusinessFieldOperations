import './HeroCard.css';

import 'mdui/components/avatar.js';
import 'mdui/components/chip.js';
import 'mdui/components/badge.js';

interface HeroCardProps {
  avatarSrc?: string;
  avatarIcon?: string;
  title: string;
  chips?: string[];
  badge?: string;
  avatarAlt?: string;
}

export default function HeroCard({
  avatarSrc,
  avatarIcon,
  title,
  chips = [],
  badge,
  avatarAlt,
}: HeroCardProps) {
  return (
    <section class="hero-card">
      <mdui-avatar
        icon={avatarIcon}
        src={avatarSrc}
        aria-label={avatarAlt ?? title}
      />
      <h2 class="title">{title}</h2>

      {chips.length > 0 && (
        <div class="chips" role="group" aria-label="Groups">
          {chips.map(chip => (
            <mdui-chip key={chip}>{chip}</mdui-chip>
          ))}
        </div>
      )}

      {badge && <mdui-badge>{badge}</mdui-badge>}
    </section>
  );
}
