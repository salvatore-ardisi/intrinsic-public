import DropdownPicker from './DropdownPicker';

interface Props {
  tickers: string[];
  selected: string;
  onSelect: (ticker: string) => void;
}

export default function CompanyPicker({ tickers, selected, onSelect }: Props) {
  return (
    <DropdownPicker
      items={tickers}
      selected={selected}
      onSelect={onSelect}
      allLabel="ALL COMPANIES"
      title="SELECT COMPANY"
    />
  );
}
