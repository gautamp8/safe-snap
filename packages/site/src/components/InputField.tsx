import { ComponentProps } from 'react';
import styled from 'styled-components';
// import { MetamaskState } from '../hooks';

const Input = styled.input`
  type: 'text';
  size: 150;
  width: 500px;
  font-size: 20;
  border-radius: 3px;
  border: 1px solid palevioletred;
  display: block;
  margin: 0 0 1em;
  padding: 1.5em;
`;

export const InputField = (props: ComponentProps<typeof Input>) => {
  return <Input {...props} />;
};
