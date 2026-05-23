import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, Pressable,
  StyleSheet,
} from 'react-native';
import { colors, fonts } from '../config/theme';

interface Props {
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
  allLabel: string;
  title: string;
}

export default function DropdownPicker({ items, selected, onSelect, allLabel, title }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={s.btn}
        activeOpacity={0.7}
        onPress={() => setVisible(true)}
      >
        <Text style={[s.btnText, selected !== 'ALL' && s.btnTextActive]}>
          {selected === 'ALL' ? allLabel : selected}
        </Text>
        <Text style={s.arrow}>▼</Text>
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setVisible(false)}>
          <View style={s.content}>
            <Text style={s.title}>{title}</Text>
            <FlatList
              data={['ALL', ...items]}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(item);
                    setVisible(false);
                  }}
                >
                  <Text style={[s.rowText, item === selected && s.rowTextActive]}>
                    {item === 'ALL' ? allLabel : item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
  },
  btnText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  btnTextActive: {
    color: colors.accent,
  },
  arrow: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textMuted,
    marginLeft: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '75%',
    maxHeight: '60%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  rowTextActive: {
    color: colors.accent,
  },
});
