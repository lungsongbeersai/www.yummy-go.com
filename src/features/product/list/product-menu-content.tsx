import { isDefaultMenuVariant, type MenuProduct } from "./product-menu-utils";
import type { ProductMenuCopy } from "./product-menu-surface";

export function ProductMenuDetails({ item, copy }: { item: MenuProduct; copy: ProductMenuCopy }) {
  const singlePrice = item.prices.length === 1 ? item.prices[0] : null;
  const headlinePrice = singlePrice && (item.type === "set" || (!item.originalId && isDefaultMenuVariant(singlePrice.label))) ? singlePrice : null;
  const options = headlinePrice ? [] : item.prices;
  return (
      <div className="product-menu-item-content">
        <h3>{item.name}</h3>
        {item.secondaryName ? <p className="product-menu-item-secondary">{item.secondaryName}</p> : null}
        {headlinePrice ? <div className="product-menu-single-price">
          <strong>{headlinePrice.priceText}</strong>
          {item.type === "set" ? <span>{copy.setPriceLabel}</span> : null}
        </div> : null}
        {options.length ? <div className="product-menu-variants">
          <dl className="product-menu-prices">{options.map((price) => <div className="product-menu-price-row" key={price.id}>
            <dt>{price.label}</dt><dd>{price.priceText}</dd>
          </div>)}</dl>
        </div> : null}
        {item.options.length ? <div className="product-menu-set-options">
          <p>{copy.setOptions}</p>
          <ul>{item.options.map((option, index) => <li key={`${index}:${option}`}>{option}</li>)}</ul>
        </div> : null}
      </div>
  );
}
