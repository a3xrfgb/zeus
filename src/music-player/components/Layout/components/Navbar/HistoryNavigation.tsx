import NavigationButton from './NavigationButton';
import ForwardBackwardsButton from './ForwardBackwardsButton';

import { memo } from 'react';

const HistoryNavigation = memo(() => {
  return (
    <div className='flex flex-row items-center gap-2 h-full'>
      <ForwardBackwardsButton flip />
      <ForwardBackwardsButton flip={false} />
    </div>
  );
});

export default HistoryNavigation;
