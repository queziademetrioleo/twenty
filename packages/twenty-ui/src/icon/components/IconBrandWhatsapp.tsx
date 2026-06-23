import IconWhatsappRaw from '@assets/icons/whatsapp.svg?react';
import { type IconComponentProps } from '@ui/icon/types/IconComponent';
import { useTheme } from '@ui/theme-constants';

type IconBrandWhatsappProps = Pick<IconComponentProps, 'size' | 'stroke'>;

export const IconBrandWhatsapp = (props: IconBrandWhatsappProps) => {
  const theme = useTheme();
  const size = props.size ?? theme.icon.size.lg;

  return <IconWhatsappRaw height={size} width={size} />;
};
