import PopoverContent from './PopoverContent';
import { useControls } from './useControls';

interface LazyPopoverContentProps {
  onOpenStore: () => void;
  setUpdating: (updating: boolean) => void;
}

const LazyPopoverContent = ({ onOpenStore, setUpdating }: LazyPopoverContentProps) => {
  const { marketItems } = useControls({
    setUpdating,
  });

  return <PopoverContent items={marketItems} onOpenStore={onOpenStore} />;
};

export default LazyPopoverContent;
