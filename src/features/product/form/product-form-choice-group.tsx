import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Choice<T extends string> = { value: T; label: string; hint: string };

// shadcn "choice card": FieldLabel wrapping a horizontal Field highlights itself
// when its RadioGroupItem is checked, so no hand-rolled active styles are needed.
export function ProductFormChoiceGroup<T extends string>({
  id,
  legend,
  choices,
  value,
  onValueChange,
  className,
}: {
  id: string;
  legend: string;
  choices: ReadonlyArray<Choice<T>>;
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup
        className={className}
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
      >
        {choices.map((choice) => {
          const itemId = `${id}-${choice.value}`;
          return (
            <FieldLabel key={choice.value} htmlFor={itemId}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{choice.label}</FieldTitle>
                  <FieldDescription>{choice.hint}</FieldDescription>
                </FieldContent>
                <RadioGroupItem id={itemId} value={choice.value} />
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}
