import"./chunk-DCANE7XH.js";var n=`import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  NumberField,
  NumberFieldInput,
} from "@/components/ui/number-field";

export default function Particle() {
  return (
    <InputGroup>
      <NumberField defaultValue={10}>
        <NumberFieldInput aria-label="Enter the amount" className="text-left" />
      </NumberField>
      <InputGroupAddon>
        <InputGroupText>\u20AC</InputGroupText>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <InputGroupText>EUR</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}
`;export{n as default};
