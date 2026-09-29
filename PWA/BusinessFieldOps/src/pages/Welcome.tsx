import 'mdui/components/layout.js';
import 'mdui/components/layout-main.js';

import MainTitle from '@/components/MainTitle';

export default function Welcome() {
  return (
    <mdui-layout full-height>
      <mdui-layout-main>
        <MainTitle />
        <p>Welcome</p>
      </mdui-layout-main>
    </mdui-layout>
  );
}
