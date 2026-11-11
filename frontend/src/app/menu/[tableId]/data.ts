export const RESTAURANT = { name: "Café Monsoon", tableLabel: "TABLE 6" }

export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  veg: boolean
  tag?: string
  category: string
}

export const MENU_ITEMS: MenuItem[] = [
  { id: "1", name: "Carbonara Ramyun",      price: 320, veg: false, tag: "BESTSELLER", category: "Bestsellers", description: "Creamy, smoky, a little fiery" },
  { id: "2", name: "Gochujang Paneer Bao",  price: 240, veg: true,  category: "Bestsellers", description: "Crisp paneer, pickled onion" },
  { id: "3", name: "Chilli Garlic Edamame", price: 220, veg: true,  category: "Starters",    description: "Tossed in brown butter" },
  { id: "4", name: "Iced Hibiscus Cooler",  price: 160, veg: true,  category: "Drinks",      description: "House-brewed, barely sweet" },
  { id: "5", name: "Kimchi Fried Rice",     price: 280, veg: false, category: "Mains",       description: "Fried egg on top" },
]

export const CATEGORIES = ["Bestsellers", "Starters", "Mains", "Drinks"]
