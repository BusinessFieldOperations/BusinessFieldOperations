import './MainTitle.css';

import {config} from '@/config';

// The title can be either text, text with a font, or a image
export default function MainTitle() {
  return <h1>{config.name}</h1>;
}
