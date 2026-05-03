import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./lib/conexion";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [pagina, setPagina] = useState("dashboard");
  const [login, setLogin] = useState({ user: "", pass: "" });
  const [productos, setProductos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [editando, setEditando] = useState(false);
  const [idEditar, setIdEditar] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    categoria: "",
    stock: "",
    stock_min: "",
    precio_compra: "",
    precio_venta: "",
    fecha_vencimiento: ""
  });

  // ✅ Login desde Supabase — sin objeto hardcodeado
  const iniciarSesion = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase
      .from("usuarios")
      .select("*, roles(nombre)")
      .eq("username", login.user)
      .eq("password", login.pass)
      .eq("activo", true)
      .single();

    if (error || !data) {
      alert("Credenciales incorrectas");
      return;
    }

    const usuarioLogueado = {
      nombre: data.nombre,
      rol: data.roles.nombre
    };

    setUsuario(usuarioLogueado);
    setPagina(usuarioLogueado.rol === "almacen" ? "productos" : "dashboard");
  };

  const cerrarSesion = () => {
    setUsuario(null);
    setPagina("dashboard");
  };

  const cargarProductos = async () => {
    const { data, error } = await supabase.from("productos").select("*");
    if (!error) setProductos(data);
  };

  useEffect(() => {
    if (usuario) cargarProductos();
  }, [usuario]);

  const cambiarDato = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const limpiarFormulario = () => {
    setForm({
      nombre: "",
      categoria: "",
      stock: "",
      stock_min: "",
      precio_compra: "",
      precio_venta: "",
      fecha_vencimiento: ""
    });
    setEditando(false);
    setIdEditar(null);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    if (editando) {
      await supabase.from("productos").update(form).eq("id", idEditar);
    } else {
      await supabase.from("productos").insert([form]);
    }
    cargarProductos();
    limpiarFormulario();
  };

  const cargarParaEditar = (p) => {
    setEditando(true);
    setIdEditar(p.id);
    setForm({
      nombre: p.nombre,
      categoria: p.categoria,
      stock: p.stock,
      stock_min: p.stock_min,
      precio_compra: p.precio_compra,
      precio_venta: p.precio_venta,
      fecha_vencimiento: p.fecha_vencimiento?.substring(0, 10)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarProducto = async (id) => {
    if (window.confirm("¿Eliminar producto?")) {
      await supabase.from("productos").delete().eq("id", id);
      cargarProductos();
    }
  };

  const obtenerEstado = (fecha) => {
    const dias = (new Date(fecha) - new Date()) / 86400000;
    if (dias < 0) return { texto: "Vencido", clase: "vencido" };
    if (dias <= 30) return { texto: "Por vencer", clase: "por-vencer" };
    return { texto: "Normal", clase: "normal" };
  };

  const calcularKPI = () => {
    let total = productos.length;
    let bajoStock = 0;
    let vencidos = 0;
    let porVencer = 0;
    let valorInventario = 0;
    let ganancia = 0;

    productos.forEach((p) => {
      const estado = obtenerEstado(p.fecha_vencimiento);
      const stock = Number(p.stock);
      const min = Number(p.stock_min);
      const compra = Number(p.precio_compra);
      const venta = Number(p.precio_venta);

      if (stock <= min) bajoStock++;
      if (estado.texto === "Vencido") vencidos++;
      if (estado.texto === "Por vencer") porVencer++;

      valorInventario += stock * compra;
      ganancia += (venta - compra) * stock;
    });

    return { total, bajoStock, vencidos, porVencer, valorInventario, ganancia };
  };

  const exportarCSV = () => {
    const encabezado = [
      "Nombre", "Categoria", "Stock", "Stock minimo",
      "Precio compra", "Precio venta", "Vencimiento",
      "Estado", "Valor inventario", "Ganancia estimada"
    ];

    const filas = productos.map((p) => {
      const estado = obtenerEstado(p.fecha_vencimiento);
      const valor = Number(p.stock) * Number(p.precio_compra);
      const ganancia = (Number(p.precio_venta) - Number(p.precio_compra)) * Number(p.stock);
      return [
        p.nombre, p.categoria, p.stock, p.stock_min,
        p.precio_compra, p.precio_venta,
        p.fecha_vencimiento?.substring(0, 10),
        estado.texto, valor.toFixed(2), ganancia.toFixed(2)
      ];
    });

    let csv = "\uFEFF" + encabezado.join(";") + "\n";
    filas.forEach((fila) => { csv += fila.join(";") + "\n"; });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporte_freshstock.csv";
    link.click();
  };

  const resumenCategorias = () => {
    const resumen = {};
    productos.forEach((p) => {
      resumen[p.categoria] = (resumen[p.categoria] || 0) + 1;
    });
    return Object.entries(resumen);
  };

  const productosFiltrados = productos.filter((p) => {
    const estado = obtenerEstado(p.fecha_vencimiento);
    if (filtro === "todos") return true;
    if (filtro === "normal") return estado.texto === "Normal";
    if (filtro === "por-vencer") return estado.texto === "Por vencer";
    if (filtro === "vencido") return estado.texto === "Vencido";
    if (filtro === "bajo-stock") return Number(p.stock) <= Number(p.stock_min);
    return true;
  });

  const kpi = calcularKPI();

  if (!usuario) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>FreshStock</h1>
          <p>Sistema de inventario para productos perecibles</p>
          <form className="login-form" onSubmit={iniciarSesion}>
            <input
              placeholder="Usuario"
              value={login.user}
              onChange={(e) => setLogin({ ...login, user: e.target.value })}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={login.pass}
              onChange={(e) => setLogin({ ...login, pass: e.target.value })}
            />
            <button>Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  const puedeVerDashboard = usuario.rol === "admin" || usuario.rol === "dueno";
  const puedeRegistrar = usuario.rol === "admin" || usuario.rol === "almacen";
  const puedeVerGanancias = usuario.rol === "admin" || usuario.rol === "dueno";

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>FreshStock</h2>
        <p className="role">{usuario.nombre}</p>

        {puedeVerDashboard && (
          <button onClick={() => setPagina("dashboard")}>Dashboard</button>
        )}
        <button onClick={() => setPagina("productos")}>Inventario</button>
        {puedeVerGanancias && (
          <button onClick={() => setPagina("reportes")}>Reportes</button>
        )}
        <button className="logout" onClick={cerrarSesion}>Cerrar sesión</button>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>
            {usuario.rol === "admin" && "Panel Administrador"}
            {usuario.rol === "almacen" && "Panel Almacenero"}
            {usuario.rol === "dueno" && "Panel Dueño"}
          </h1>
          <span>Rol: {usuario.rol}</span>
        </header>

        {pagina === "dashboard" && puedeVerDashboard && (
          <>
            <h2>Dashboard KPI</h2>
            <div className="kpi-container">
              <div className="kpi-card">Total productos<br /><b>{kpi.total}</b></div>
              <div className="kpi-card">Bajo stock<br /><b>{kpi.bajoStock}</b></div>
              <div className="kpi-card">Vencidos<br /><b>{kpi.vencidos}</b></div>
              <div className="kpi-card">Por vencer<br /><b>{kpi.porVencer}</b></div>
              <div className="kpi-card">Valor inventario<br /><b>S/ {kpi.valorInventario.toFixed(2)}</b></div>
              <div className="kpi-card">Ganancia estimada<br /><b>S/ {kpi.ganancia.toFixed(2)}</b></div>
            </div>

            <h2>Gráfico de estados</h2>
            <div className="chart-box">
              <div className="bar normal">Normales: {kpi.total - kpi.vencidos - kpi.porVencer}</div>
              <div className="bar por-vencer">Por vencer: {kpi.porVencer}</div>
              <div className="bar vencido">Vencidos: {kpi.vencidos}</div>
            </div>
          </>
        )}

        {pagina === "productos" && (
          <>
            <h2>Inventario de productos</h2>
            <div className="filter-box">
              <button onClick={() => setFiltro("todos")}>Todos</button>
              <button onClick={() => setFiltro("normal")}>Normal</button>
              <button onClick={() => setFiltro("por-vencer")}>Por vencer</button>
              <button onClick={() => setFiltro("vencido")}>Vencidos</button>
              <button onClick={() => setFiltro("bajo-stock")}>Bajo stock</button>
            </div>

            {puedeRegistrar && (
              <form className="product-form" onSubmit={guardarProducto}>
                <input name="nombre" placeholder="Nombre" value={form.nombre} onChange={cambiarDato} required />
                <input name="categoria" placeholder="Categoría" value={form.categoria} onChange={cambiarDato} required />
                <input name="stock" type="number" placeholder="Stock" value={form.stock} onChange={cambiarDato} required />
                <input name="stock_min" type="number" placeholder="Stock mínimo" value={form.stock_min} onChange={cambiarDato} required />
                <input name="precio_compra" type="number" step="0.01" placeholder="Precio compra" value={form.precio_compra} onChange={cambiarDato} required />
                <input name="precio_venta" type="number" step="0.01" placeholder="Precio venta" value={form.precio_venta} onChange={cambiarDato} required />
                <input name="fecha_vencimiento" type="date" value={form.fecha_vencimiento} onChange={cambiarDato} required />
                <button>{editando ? "Actualizar producto" : "Guardar producto"}</button>
                {editando && (
                  <button type="button" className="cancel-btn" onClick={limpiarFormulario}>Cancelar</button>
                )}
              </form>
            )}

            {usuario.rol === "dueno" && (
              <div className="notice">Vista solo lectura: el dueño revisa inventario y ganancias.</div>
            )}

            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Stock mín.</th>
                  {puedeVerGanancias && <th>Compra</th>}
                  {puedeVerGanancias && <th>Venta</th>}
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  {usuario.rol === "admin" && <th>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => {
                  const estado = obtenerEstado(p.fecha_vencimiento);
                  return (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{p.categoria}</td>
                      <td>{p.stock}</td>
                      <td>{p.stock_min}</td>
                      {puedeVerGanancias && <td>S/ {p.precio_compra}</td>}
                      {puedeVerGanancias && <td>S/ {p.precio_venta}</td>}
                      <td>{p.fecha_vencimiento?.substring(0, 10)}</td>
                      <td><span className={`badge ${estado.clase}`}>{estado.texto}</span></td>
                      {usuario.rol === "admin" && (
                        <td>
                          <button onClick={() => cargarParaEditar(p)}>Editar</button>
                          <button className="delete-btn" onClick={() => eliminarProducto(p.id)}>Eliminar</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {pagina === "reportes" && puedeVerGanancias && (
          <>
            <h2>Reportes para Excel</h2>
            <button onClick={exportarCSV}>Exportar CSV para Excel</button>
            <div className="report-card">Ganancia estimada total: <b>S/ {kpi.ganancia.toFixed(2)}</b></div>
            <div className="report-card">Valor total del inventario: <b>S/ {kpi.valorInventario.toFixed(2)}</b></div>
            <div className="report-card">Productos por vencer: <b>{kpi.porVencer}</b></div>

            <h2>Gráfico por categorías</h2>
            <div className="chart-box">
              {resumenCategorias().map(([categoria, cantidad]) => (
                <div key={categoria} className="bar categoria">{categoria}: {cantidad}</div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;